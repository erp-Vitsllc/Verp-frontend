'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import PermissionGuard from '@/components/PermissionGuard';
import axiosInstance from '@/utils/axios';
import { useToast } from '@/hooks/use-toast';
import { Search, RotateCcw, Truck, Plus, LayoutDashboard, Bell, Trash2, Filter, Pencil, Car, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { isAdmin, hasPermission } from '@/utils/permissions';
import {
    isVehicleProfileActivationActive,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleAdminDeleteAccess';
import { canAccessAddVehicle, canAccessActiveFleet, canAccessSoldFleet, canEditVehicleAsset } from '@/app/HRM/Asset/Vehicle/utils/vehiclePermissionAccess';

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
import { navigateFromList, rememberListFilterStep, replaceNavigationUrl } from '@/utils/listReturnNavigation';
import ListTableRowLink from '@/components/ListTableRowLink';
import Link from 'next/link';
import AddVehicleModal from '@/app/HRM/Asset/Vehicle/components/AddVehicleModal';
import VehiclePlateThumbnail from '@/app/HRM/Asset/Vehicle/components/VehiclePlateThumbnail';
import {
    getVehicleProfileStatusLabel,
    resolveVehicleListAssigneeStr,
    resolveVehicleListAssignedToDisplay,
    resolveVehicleListServiceStatusLabel,
    vehicleProfileStatusBadgeClass,
} from '@/app/HRM/Asset/Vehicle/components/vehicleAssetStatusUi';
import VehicleListAssignmentStatusCell from '@/app/HRM/Asset/Vehicle/components/VehicleListAssignmentStatusCell';
import VehicleListServiceStatusCell from '@/app/HRM/Asset/Vehicle/components/VehicleListServiceStatusCell';
import VehicleAccessServicePanel from '@/app/HRM/Asset/Vehicle/components/VehicleAccessServicePanel';
import VehicleAccessHandoverPanel from '@/app/HRM/Asset/Vehicle/components/VehicleAccessHandoverPanel';
import VehicleAccessFinePanel from '@/app/HRM/Asset/Vehicle/components/VehicleAccessFinePanel';
import VehicleAccessMenuModal from '@/app/HRM/Asset/Vehicle/components/VehicleAccessMenuModal';
import VehicleFuelModal from '@/app/HRM/Asset/Vehicle/components/VehicleFuelModal';
import PendingAssetRequestsModal from '@/app/HRM/Asset/components/PendingAssetRequestsModal';
import {
    countVisibleAssetPendingInbox,
    countDisplayableAssetPendingInbox,
    invalidateAssetPendingInbox,
    ASSET_PENDING_INBOX_CHANGED,
} from '@/app/HRM/Asset/utils/assetPendingInboxCount';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';
import {
    MODULE_NOTIFICATIONS_UPDATED,
    getVehicleModuleInboxCount,
    getVehicleModuleInboxRows,
} from '@/utils/moduleNotifications';
import { AssetListSummaryPanels } from '@/app/HRM/Asset/components/ListPageSummaryCards';
import {
    readVehicleListCache,
    saveVehicleListCache,
} from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetCache';
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
import { applyVehicleAccessFineQuery, vehicleDashboardKpiHref, vehicleMatchesModelYearFilter } from '@/app/HRM/Asset/Vehicle/utils/vehicleFleetDashboardNavigation';

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

const VEHICLE_LIST_COLUMNS = [
    { key: 'assetId', label: 'Id', type: 'text' },
    { key: 'plateNumber', label: 'Plate No', type: 'text' },
    { key: 'modelYear', label: 'Model Year', type: 'number' },
    { key: 'currentKm', label: 'Current KM', type: 'number' },
    { key: 'registrationExpiry', label: 'Registration Expiry', type: 'date' },
    { key: 'gpsStatus', label: 'GPS Status', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'assignedTo', label: 'Assigned To', type: 'text' },
    { key: 'serviceStatus', label: 'Service Status', type: 'text' },
];

function vehicleRegistrationExpiryValue(v) {
    return (
        v?.registrationExpiryDate ||
        v?.registrationExpiry ||
        v?.documents?.find?.((d) =>
            String(d?.type || '')
                .toLowerCase()
                .includes('registration'),
        )?.expiryDate ||
        null
    );
}

function vehicleListSortValue(v, key) {
    switch (key) {
        case 'assetId':
            return String(v?.assetId || v?.vehicleCode || '').trim();
        case 'plateNumber':
            return String(v?.plateNumber || '').trim();
        case 'modelYear': {
            const n = Number(v?.modelYear);
            return Number.isFinite(n) ? n : null;
        }
        case 'currentKm': {
            const raw =
                v?.locator?.currentKilometer != null
                    ? v.locator.currentKilometer
                    : v?.currentKilometer;
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
        }
        case 'registrationExpiry': {
            const raw = vehicleRegistrationExpiryValue(v);
            if (!raw) return null;
            const t = new Date(raw).getTime();
            return Number.isFinite(t) ? t : null;
        }
        case 'gpsStatus':
            return isVehicleGpsConnected(v) ? 'Connected' : 'Not connected';
        case 'status':
            return getVehicleProfileStatusLabel(v) || '';
        case 'assignedTo':
            return String(resolveVehicleListAssignedToDisplay(v) || resolveVehicleListAssigneeStr(v) || v?.status || '').trim();
        case 'serviceStatus':
            return resolveVehicleListServiceStatusLabel(v) || '';
        default:
            return '';
    }
}

function compareVehicleListSortValues(a, b, key, type, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    const av = vehicleListSortValue(a, key);
    const bv = vehicleListSortValue(b, key);
    const aEmpty = av == null || av === '';
    const bEmpty = bv == null || bv === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (type === 'number' || type === 'date') {
        return (Number(av) - Number(bv)) * dir;
    }

    return (
        String(av).localeCompare(String(bv), undefined, {
            numeric: true,
            sensitivity: 'base',
        }) * dir
    );
}

const SOLD_TOTAL_LOSS_VIEW = 'sold-total-loss';

function buildVehicleListHref({
    searchQuery = '',
    statusFilter = 'All',
    fleetListTab = 'active',
    modelYearFilter = '',
    includeFineAccess = false,
    fineFocus = null,
} = {}) {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter);
    if (fleetListTab === 'sold_total_loss') params.set('view', SOLD_TOTAL_LOSS_VIEW);
    if (modelYearFilter) params.set('modelYear', String(modelYearFilter));
    if (includeFineAccess) {
        applyVehicleAccessFineQuery(params, {
            access: 'fine',
            vehicleId: fineFocus?.vehicleId,
            fineIds: fineFocus?.fineIds,
            from: fineFocus?.from,
            to: fineFocus?.to,
            plate: fineFocus?.plate,
        });
    }
    const qs = params.toString();
    return qs ? `/HRM/Asset/Vehicle?${qs}` : '/HRM/Asset/Vehicle';
}

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
    // Start empty on server + first client paint so SSR HTML matches hydration.
    // Session cache is applied in useEffect after mount (avoids 0 vs N mismatch).
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [modelYearFilter, setModelYearFilter] = useState('');
    const [showFilters, setShowFilters] = useState(true);
    const [sortKey, setSortKey] = useState('assetId');
    const [sortDirection, setSortDirection] = useState('asc');
    const { toast } = useToast();
    const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
    const [addVehicleEditId, setAddVehicleEditId] = useState(null);
    const [addVehicleModalTitle, setAddVehicleModalTitle] = useState(undefined);
    const [vehicleInboxOpen, setVehicleInboxOpen] = useState(false);
    const [vehicleInboxCount, setVehicleInboxCount] = useState(0);
    const [accessServiceOpen, setAccessServiceOpen] = useState(false);
    const [selectedAccessServiceType, setSelectedAccessServiceType] = useState('All');
    const [accessHandoverOpen, setAccessHandoverOpen] = useState(false);
    const [selectedHandoverCategory, setSelectedHandoverCategory] = useState('all');
    const [accessFineOpen, setAccessFineOpen] = useState(false);
    const [accessMenuOpen, setAccessMenuOpen] = useState(false);
    const [fuelModalOpen, setFuelModalOpen] = useState(false);
    const [fuelVehicles, setFuelVehicles] = useState([]);
    const [canManageFuel, setCanManageFuel] = useState(false);
    const [selectedFineType, setSelectedFineType] = useState('all');
    const [fineFocus, setFineFocus] = useState({
        vehicleId: '',
        fineIds: '',
        from: '',
        to: '',
        plate: '',
    });
    const [fleetListTab, setFleetListTab] = useState('active');
    const accessPanelOpen = accessServiceOpen || accessHandoverOpen || accessFineOpen;

    const vehicleListHref = useMemo(
        () =>
            buildVehicleListHref({
                searchQuery,
                statusFilter,
                fleetListTab,
                modelYearFilter,
                includeFineAccess: accessFineOpen,
                fineFocus,
            }),
        [searchQuery, statusFilter, fleetListTab, modelYearFilter, accessFineOpen, fineFocus],
    );

    const toggleAccessPanel = useCallback((panel) => {
        const isOpen =
            panel === 'service'
                ? accessServiceOpen
                : panel === 'handover'
                  ? accessHandoverOpen
                  : accessFineOpen;
        const emptyFocus = { vehicleId: '', fineIds: '', from: '', to: '', plate: '' };
        const syncListUrl = (includeFineAccess, nextFocus = emptyFocus) => {
            replaceNavigationUrl(
                buildVehicleListHref({
                    searchQuery,
                    statusFilter,
                    fleetListTab,
                    modelYearFilter,
                    includeFineAccess,
                    fineFocus: nextFocus,
                }),
            );
        };

        if (isOpen) {
            setAccessServiceOpen(false);
            setAccessHandoverOpen(false);
            setAccessFineOpen(false);
            setFineFocus(emptyFocus);
            syncListUrl(false);
            return;
        }

        setAccessServiceOpen(panel === 'service');
        setAccessHandoverOpen(panel === 'handover');
        setAccessFineOpen(panel === 'fine');
        if (panel === 'service') setSelectedAccessServiceType('All');
        if (panel === 'handover') setSelectedHandoverCategory('all');
        if (panel === 'fine') {
            setSelectedFineType('all');
            setFineFocus(emptyFocus);
            syncListUrl(true, emptyFocus);
            return;
        }
        setFineFocus(emptyFocus);
        syncListUrl(false);
    }, [accessServiceOpen, accessHandoverOpen, accessFineOpen, searchQuery, statusFilter, fleetListTab, modelYearFilter]);

    const openFuelModal = useCallback(async () => {
        setAccessMenuOpen(false);
        setFuelModalOpen(true);
        try {
            const res = await axiosInstance.get('/VehicleFuel/vehicles', { skipToast: true });
            setFuelVehicles(Array.isArray(res.data?.data) ? res.data.data : []);
            setCanManageFuel(Boolean(res.data?.canManage));
        } catch {
            setFuelVehicles([]);
            setCanManageFuel(false);
        }
    }, []);

    const vehicleInboxWarmRef = useRef(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, vehicle: null });

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
            setAddVehicleModalTitle(
                vehicle.needsLocatorSetup || !String(vehicle.plateNumber || '').trim()
                    ? 'Setup Locator vehicle'
                    : undefined,
            );
            setIsAddVehicleModalOpen(true);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Edit failed',
                description: error?.response?.data?.message || 'Could not open vehicle editor.',
            });
        }
    }, [toast]);

    const canViewActiveFleet = mounted && canAccessActiveFleet();
    const canViewSoldFleet = mounted && canAccessSoldFleet();

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

    const fetchVehicleInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'vehicle',
                skipSync: true,
                skipToast: true,
                force,
            });
            const merged = [...(items || []), ...getVehicleModuleInboxRows()];
            setVehicleInboxCount(countDisplayableAssetPendingInbox(merged));
        } catch {
            setVehicleInboxCount(countDisplayableAssetPendingInbox(getVehicleModuleInboxRows()));
        }
    }, []);

    const warmVehicleInboxBadge = useCallback(() => {
        if (vehicleInboxWarmRef.current) return;
        vehicleInboxWarmRef.current = true;
        const cached = countDisplayableAssetPendingInbox(getVehicleModuleInboxRows());
        if (cached > 0) setVehicleInboxCount(cached);
        else if (getVehicleModuleInboxCount() > 0) setVehicleInboxCount(getVehicleModuleInboxCount());
        fetchVehicleInboxCount();
    }, [fetchVehicleInboxCount]);

    const vehiclesRef = useRef(vehicles);
    vehiclesRef.current = vehicles;

    const fetchVehicles = useCallback(async ({ silent = false } = {}) => {
        const hasRowsOnScreen = (vehiclesRef.current?.length || 0) > 0;
        const hasCachedRows = hasRowsOnScreen || (readVehicleListCache()?.length || 0) > 0;
        try {
            // Keep cached rows visible — only show spinner when there is nothing to paint.
            if (!silent && !hasCachedRows) setLoading(true);

            // Fast path: ERP list only — GPS lives on AssetItem from the 30-min Locator sync.
            // Do NOT call live Locator here; that was freezing Vehicle Asset pages.
            const fleetRes = await axiosInstance.get('/AssetItem/vehicle-fleet-dashboard', {
                params: { scope: 'list' },
                timeout: 20000,
                skipToast: true,
            });
            const fleetVehicles = Array.isArray(fleetRes.data?.vehicles)
                ? fleetRes.data.vehicles
                : [];
            const erpRows = fleetVehicles.filter((row) => !isToolsAssetNotFleetVehicle(row));
            setVehicles(erpRows);
            saveVehicleListCache(erpRows);
            if (!silent) setLoading(false);
        } catch (error) {
            if (!hasCachedRows) {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to fetch vehicle assets.',
                });
            }
            if (!silent) setLoading(false);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [toast]);

    const handleDeleteVehicle = useCallback(async () => {
        if (!deleteConfirm.vehicle?._id) return;
        const vehicle = deleteConfirm.vehicle;
        const profileActive = isVehicleProfileActivationActive(vehicle);
        try {
            if (profileActive) {
                const res = await axiosInstance.post(`/AssetItem/${vehicle._id}/request-vehicle-delete`, null, {
                    skipToast: true,
                });
                if (res.data?.deleted) {
                    toast({ title: 'Deleted', description: 'Vehicle deleted successfully.' });
                } else {
                    toast({
                        title: 'Delete request sent',
                        description: res.data?.message || 'HR approval is required for active vehicles.',
                    });
                }
            } else {
                await axiosInstance.delete(`/AssetItem/${vehicle._id}`, { skipToast: true });
                toast({ title: 'Deleted', description: 'Vehicle deleted successfully.' });
            }
            setDeleteConfirm({ isOpen: false, vehicle: null });
            fetchVehicles();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: error?.response?.data?.message || 'Could not delete vehicle.',
            });
        }
    }, [deleteConfirm.vehicle, fetchVehicles, toast]);

    const isFleetAdmin = mounted && isAdmin();
    const canEditInactiveVehicleFromList =
        mounted && (isAdmin() || canEditVehicleAsset());
    // List delete matches Tools assets: portal Super User / admin only.
    const canDeleteVehicleFromList = isFleetAdmin;
    const showVehicleRowActions = canEditInactiveVehicleFromList || canDeleteVehicleFromList;
    const tableColSpan = showVehicleRowActions ? 11 : 10;

    useEffect(() => {
        setMounted(true);
        const cached = readVehicleListCache();
        if (cached?.length) {
            setVehicles(cached);
            setLoading(false);
        }
        fetchVehicles();
    }, [fetchVehicles]);

    useEffect(() => {
        if (!mounted) return;
        const timer = setTimeout(() => {
            rememberListFilterStep(vehicleListHref);
        }, 350);
        return () => clearTimeout(timer);
    }, [mounted, vehicleListHref]);

    useEffect(() => {
        if (!mounted || typeof window === 'undefined') return;
        setFleetListTab(readFleetListTabFromUrl());
        const fromUrl = normalizeVehicleStatusFilter(
            new URLSearchParams(window.location.search).get('status'),
        );
        setStatusFilter(fromUrl);
        if (fromUrl !== 'All') setShowFilters(true);

        const q = new URLSearchParams(window.location.search);
        const yearFromUrl = String(q.get('modelYear') || '').trim();
        if (yearFromUrl) {
            setModelYearFilter(yearFromUrl);
            setShowFilters(true);
        }
        if (String(q.get('access') || '').trim().toLowerCase() === 'fine') {
            setAccessServiceOpen(false);
            setAccessHandoverOpen(false);
            setAccessFineOpen(true);
            setSelectedFineType('all');
            setFineFocus({
                vehicleId: String(q.get('vehicleId') || '').trim(),
                fineIds: String(q.get('fineIds') || '').trim(),
                from: String(q.get('from') || '').trim(),
                to: String(q.get('to') || '').trim(),
                plate: String(q.get('plate') || '').trim(),
            });
        }
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
        const onModuleUpdated = () => {
            fetchVehicleInboxCount({ force: true });
        };
        window.addEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
        window.addEventListener(MODULE_NOTIFICATIONS_UPDATED, onModuleUpdated);
        return () => {
            window.removeEventListener(ASSET_PENDING_INBOX_CHANGED, onInboxChanged);
            window.removeEventListener(MODULE_NOTIFICATIONS_UPDATED, onModuleUpdated);
        };
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
                if (!isSoldOrTotalLossDisposition(v)) return false;
            } else if (!matchesVehicleStatusFilter(v, statusFilter, ctx)) {
                return false;
            }
            return vehicleMatchesModelYearFilter(v, modelYearFilter);
        });
    }, [vehicles, searchQuery, statusFilter, fleetListTab, modelYearFilter]);

    const pendingServiceStatusCount = useMemo(
        () =>
            filteredVehicles.reduce(
                (sum, v) => sum + (resolveVehicleListServiceStatusLabel(v) === 'Pending' ? 1 : 0),
                0,
            ),
        [filteredVehicles],
    );

    const sortedFilteredVehicles = useMemo(() => {
        const column = VEHICLE_LIST_COLUMNS.find((c) => c.key === sortKey) || VEHICLE_LIST_COLUMNS[0];
        return [...filteredVehicles].sort((a, b) =>
            compareVehicleListSortValues(a, b, column.key, column.type, sortDirection),
        );
    }, [filteredVehicles, sortKey, sortDirection]);

    const handleSort = useCallback((key) => {
        const column = VEHICLE_LIST_COLUMNS.find((c) => c.key === key);
        if (!column) return;
        if (sortKey === key) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection(column.type === 'date' || column.type === 'number' ? 'desc' : 'asc');
    }, [sortKey]);

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
            { label: 'Total Vehicle', value: vehicleListStats.total, filterKey: 'total', href: '/HRM/Asset/Vehicle' },
            { label: 'Assigned Vehicle', value: vehicleListStats.assigned, filterKey: 'assigned', href: vehicleDashboardKpiHref('assigned') },
            { label: 'Unassigned Vehicle', value: vehicleListStats.unassigned, filterKey: 'unassigned', href: vehicleDashboardKpiHref('unassigned') },
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
            { label: 'In Service', value: vehicleListStats.inService, filterKey: 'inService', href: vehicleDashboardKpiHref('inService') },
            { label: 'Pending for approval', value: vehicleListStats.pendingApproval, filterKey: 'pendingApproval', href: '/HRM/Asset/Vehicle?status=AwaitingApproval' },
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
            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f2f6f9]">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
                    <Navbar />
                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden">

                        <AssetListSummaryPanels
                            leftCards={vehicleSummaryLeftCards}
                            rightCards={vehicleSummaryRightCards}
                            onCardClick={handleSummaryCardClick}
                            isCardActive={isSummaryCardActive}
                        />

                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Vehicle Assets</h1>
                                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                        {vehicles.length}
                                    </span>
                                </div>
                                <p className="text-gray-500 text-xs sm:text-sm">Manage company fleet and transport assets</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white border border-gray-200 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors whitespace-nowrap"
                                >
                                    <LayoutDashboard size={18} />
                                    Fleet dashboard
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setAccessMenuOpen(true)}
                                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition-colors whitespace-nowrap ${
                                        accessPanelOpen
                                            ? 'bg-teal-800 text-white hover:bg-teal-900'
                                            : 'bg-teal-600 text-white hover:bg-teal-700'
                                    }`}
                                >
                                    <Car size={16} />
                                    Vehicle Details
                                    {pendingServiceStatusCount > 0 ? (
                                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-red-600 tabular-nums">
                                            {pendingServiceStatusCount}
                                        </span>
                                    ) : null}
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
                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap"
                                >
                                    <Plus size={18} />
                                    <span className="text-sm font-medium">Add Vehicle</span>
                                </button>
                                )}

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search vehicles..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full min-w-[140px] sm:w-64 max-w-md shadow-sm"
                                    />
                                </div>

                                <button
                                    onClick={() => setShowFilters((s) => !s)}
                                    className={`relative p-2 rounded-lg transition-colors border bg-white shadow-sm ${
                                        statusFilter !== 'All' || fleetListTab === 'sold_total_loss' || modelYearFilter
                                            ? 'text-blue-600 border-blue-200 hover:bg-blue-50'
                                            : 'text-gray-500 border-gray-200 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                                    title="Filter vehicles by status"
                                >
                                    <Filter size={18} />
                                    {(statusFilter !== 'All' || fleetListTab === 'sold_total_loss' || modelYearFilter) && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {accessServiceOpen ? (
                            <VehicleAccessServicePanel
                                selectedType={selectedAccessServiceType}
                                onSelectType={setSelectedAccessServiceType}
                                onClose={() => toggleAccessPanel('service')}
                                listReturnHref={vehicleListHref}
                            />
                        ) : null}

                        {accessHandoverOpen ? (
                            <VehicleAccessHandoverPanel
                                selectedCategory={selectedHandoverCategory}
                                onSelectCategory={setSelectedHandoverCategory}
                                onClose={() => toggleAccessPanel('handover')}
                                listReturnHref={vehicleListHref}
                            />
                        ) : null}

                        {accessFineOpen ? (
                            <VehicleAccessFinePanel
                                selectedType={selectedFineType}
                                onSelectType={setSelectedFineType}
                                onClose={() => toggleAccessPanel('fine')}
                                focusVehicleId={fineFocus.vehicleId}
                                focusFineIds={fineFocus.fineIds}
                                focusFrom={fineFocus.from}
                                focusTo={fineFocus.to}
                                focusPlate={fineFocus.plate}
                                listReturnHref={vehicleListHref}
                            />
                        ) : null}

                        {showFilters && !accessPanelOpen && (
                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
                                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">
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
                                            <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">Filter by</span>
                                            <div className="relative">
                                                <select
                                                    value={statusFilter}
                                                    onChange={(e) => setStatusFilter(e.target.value)}
                                                    className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none pr-8 cursor-pointer min-w-0 max-w-full"
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
                                    {modelYearFilter ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                                            Model year {modelYearFilter}
                                            <button
                                                type="button"
                                                onClick={() => setModelYearFilter('')}
                                                className="text-teal-600 hover:text-teal-900"
                                                title="Clear model year filter"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ) : null}
                                    {(statusFilter !== 'All' || fleetListTab === 'sold_total_loss' || modelYearFilter) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter('All');
                                                setModelYearFilter('');
                                                setFleetListTabAndUrl('active');
                                            }}
                                            className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 font-medium"
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

                        {!accessPanelOpen ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-[980px] table-auto text-left border-collapse text-[11px] sm:text-xs">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100 text-[9px] sm:text-[10px] uppercase text-gray-500 font-semibold tracking-wider">
                                            <th className="px-2 sm:px-3 py-2 sm:py-2.5 whitespace-nowrap w-10 sm:w-12">
                                                SL
                                            </th>
                                            {VEHICLE_LIST_COLUMNS.map((column) => {
                                                const isActive = sortKey === column.key;
                                                return (
                                                    <th
                                                        key={column.key}
                                                        className="relative px-2 sm:px-3 py-2 sm:py-2.5 whitespace-nowrap"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSort(column.key)}
                                                            className={`inline-flex items-center gap-1 hover:text-gray-700 ${
                                                                isActive ? 'text-teal-700' : ''
                                                            }`}
                                                            title={`Sort by ${column.label}`}
                                                            aria-label={`Sort by ${column.label}${
                                                                isActive
                                                                    ? sortDirection === 'asc'
                                                                        ? ', ascending'
                                                                        : ', descending'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {column.label}
                                                            {column.key === 'serviceStatus' && pendingServiceStatusCount > 0 ? (
                                                                <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-600 tabular-nums">
                                                                    {pendingServiceStatusCount}
                                                                </span>
                                                            ) : null}
                                                            {isActive ? (
                                                                sortDirection === 'asc' ? (
                                                                    <ArrowUp size={12} className="opacity-100" />
                                                                ) : (
                                                                    <ArrowDown size={12} className="opacity-100" />
                                                                )
                                                            ) : (
                                                                <ArrowUpDown size={12} className="opacity-40" />
                                                            )}
                                                        </button>
                                                    </th>
                                                );
                                            })}
                                            {showVehicleRowActions && <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-right w-14 sm:w-20" />}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {loading && vehicles.length === 0 ? (
                                            <>
                                                {Array.from({ length: 8 }).map((_, i) => (
                                                    <tr key={`sk-${i}`} className="animate-pulse">
                                                        {Array.from({ length: tableColSpan }).map((__, j) => (
                                                            <td key={j} className="px-2 sm:px-3 py-2.5">
                                                                <div className="h-3 rounded bg-gray-100 w-[70%]" />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </>
                                        ) : vehicles.length === 0 ? (
                                            <tr>
                                                <td colSpan={tableColSpan} className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
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
                                                <td colSpan={tableColSpan} className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
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
                                                                setModelYearFilter('');
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
                                            sortedFilteredVehicles.map((vehicle, index) => {
                                                const isLocatorOnly = vehicle.isLocatorOnly === true;
                                                const locatorDeviceId = vehicle.locator?.deviceId;
                                                const locatorNameParam = vehicle.locator?.deviceName
                                                    ? `?locatorName=${encodeURIComponent(vehicle.locator.deviceName)}`
                                                    : '';
                                                const vehicleHref =
                                                    isLocatorOnly && locatorDeviceId != null
                                                        ? `/HRM/Asset/Vehicle/details/locator-${locatorDeviceId}${locatorNameParam}`
                                                        : `/HRM/Asset/Vehicle/details/${vehicle._id}`;
                                                const listReturn = vehicleListHref;
                                                const showRowDelete =
                                                    !isLocatorOnly &&
                                                    canDeleteVehicleFromList &&
                                                    !String(vehicle._id).startsWith('locator-');
                                                const deleteNeedsHr = isVehicleProfileActivationActive(vehicle);
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
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap tabular-nums text-gray-500 font-semibold text-[11px] sm:text-xs">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                                                            <span className="font-semibold text-gray-800 text-[11px] sm:text-xs whitespace-nowrap">
                                                                {vehicle.assetId || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-gray-700 whitespace-nowrap">
                                                            {vehicle.plateEmirate || vehicle.plateNumber ? (
                                                                <VehiclePlateThumbnail
                                                                    plateEmirate={vehicle.plateEmirate}
                                                                    plateNumber={vehicle.plateNumber}
                                                                    size="compact"
                                                                />
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => openInactiveVehicleEdit(vehicle, e)}
                                                                    className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold text-gray-400 bg-gray-50 ring-1 ring-gray-200 hover:bg-gray-100 hover:text-gray-600 transition-colors whitespace-nowrap"
                                                                >
                                                                    No plate
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-600 whitespace-nowrap">
                                                            {vehicle.modelYear || '-'}
                                                        </td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-600 font-mono whitespace-nowrap">
                                                            {displayKm != null && displayKm !== '' ? (
                                                                <span title={gpsStatus ? `GPS: ${gpsStatus}` : undefined}>
                                                                    {Number(displayKm).toLocaleString()} km
                                                                </span>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-600 whitespace-nowrap">
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

                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                                                            <span
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${
                                                                    gpsConnected
                                                                        ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                                                                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                                                                }`}
                                                                title={gpsConnected && gpsStatus ? gpsStatus : undefined}
                                                            >
                                                                {gpsConnected ? 'Connected' : 'Not connected'}
                                                            </span>
                                                        </td>

                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                                                            <span
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${vehicleProfileStatusBadgeClass(vehicle)}`}
                                                            >
                                                                {getVehicleProfileStatusLabel(vehicle)}
                                                            </span>
                                                        </td>

                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                                                            <VehicleListAssignmentStatusCell vehicle={vehicle} />
                                                        </td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                                                            <VehicleListServiceStatusCell vehicle={vehicle} />
                                                        </td>
                                                        {showVehicleRowActions && (
                                                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {canEditInactiveVehicleFromList &&
                                                                        isVehicleProfileInactiveForListEdit(vehicle) && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => openInactiveVehicleEdit(vehicle, e)}
                                                                                className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                                                title="Edit vehicle profile"
                                                                            >
                                                                                <Pencil size={18} />
                                                                            </button>
                                                                        )}
                                                                    {showRowDelete && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeleteConfirm({ isOpen: true, vehicle });
                                                                            }}
                                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                            title={
                                                                                deleteNeedsHr
                                                                                    ? 'Request delete (HR approval required for active vehicles)'
                                                                                    : 'Delete vehicle'
                                                                            }
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
                        ) : null}
                    </div>
                </div>
            </div>
            <VehicleAccessMenuModal
                open={accessMenuOpen}
                onClose={() => setAccessMenuOpen(false)}
                activePanel={
                    accessServiceOpen ? 'service' : accessHandoverOpen ? 'handover' : accessFineOpen ? 'fine' : null
                }
                pendingServiceCount={pendingServiceStatusCount}
                onSelect={(panel) => {
                    if (panel === 'fuel') {
                        openFuelModal();
                        return;
                    }
                    setAccessMenuOpen(false);
                    const alreadyOpen =
                        (panel === 'service' && accessServiceOpen) ||
                        (panel === 'handover' && accessHandoverOpen) ||
                        (panel === 'fine' && accessFineOpen);
                    if (alreadyOpen) return;
                    toggleAccessPanel(panel);
                }}
            />
            <VehicleFuelModal
                isOpen={fuelModalOpen}
                onClose={() => setFuelModalOpen(false)}
                onSaved={() => setFuelModalOpen(false)}
                vehicles={fuelVehicles}
                canManage={canManageFuel}
            />
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
                    isLocatorSetup={Boolean(addVehicleModalTitle)}
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

            <AlertDialog
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, vehicle: null })}
            >
                <AlertDialogContent className="bg-white rounded-[24px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Delete vehicle</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500">
                            {isVehicleProfileActivationActive(deleteConfirm.vehicle) ? (
                                <>
                                    Request deletion of{' '}
                                    <span className="font-bold text-gray-900">
                                        {deleteConfirm.vehicle?.assetId ||
                                            deleteConfirm.vehicle?.plateNumber ||
                                            'this vehicle'}
                                    </span>
                                    ? Active vehicles require HR approval before they are removed.
                                </>
                            ) : (
                                <>
                                    Permanently delete{' '}
                                    <span className="font-bold text-gray-900">
                                        {deleteConfirm.vehicle?.assetId ||
                                            deleteConfirm.vehicle?.plateNumber ||
                                            'this vehicle'}
                                    </span>
                                    ? Inactive vehicles can be deleted without HR approval. This cannot be undone.
                                </>
                            )}
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
