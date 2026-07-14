'use client';



import { useState, useEffect, useLayoutEffect, useCallback, Suspense, useMemo, useDeferredValue, useRef, Fragment } from 'react';

import Sidebar from '@/components/Sidebar';

import Navbar from '@/components/Navbar';

import PermissionGuard from '@/components/PermissionGuard';

import { isAdmin } from '@/utils/permissions';
import { canAccessAddToolsAsset } from '@/app/HRM/Asset/Vehicle/utils/vehiclePermissionAccess';
import { setCachedAssetFlowchartRoleMeta } from '@/utils/assetFlowchartModuleAccess';

import { Package, Search, Plus, Filter, MoreVertical, LayoutGrid, List as ListIcon, Shield, Laptop, Truck, Armchair, Briefcase, Download, Trash2, X, FileText, Eye, History, Undo2, ArrowRightLeft, Pencil, Bell, ExternalLink, AlertCircle } from 'lucide-react';

import AddAssetTypeModal from './components/AddAssetTypeModal';
import SearchableAssignedToFilter from './components/SearchableAssignedToFilter';

import AddAccessoryCatalogModal from './components/AddAccessoryCatalogModal';
import AttachCatalogAccessoryModal from './components/AttachCatalogAccessoryModal';

import AccessoriesModal from './components/AccessoriesModal';

import axiosInstance, { isSessionAuthError } from '@/utils/axios';

import { useToast } from '@/hooks/use-toast';
import ConfirmAlertDialog from '@/components/ConfirmAlertDialog';

import { useRouter, useSearchParams } from 'next/navigation';
import { navigateFromList, navigateFromNotificationClick, rememberListFilterStep } from '@/utils/listReturnNavigation';
import ListTableRowLink from '@/components/ListTableRowLink';
import { usePersistListReturnState } from '@/hooks/usePersistListReturnState';
import { navHrefProps } from '@/utils/linkContextMenu';
import Link from 'next/link';
import { useNotificationFocusScroll } from '@/hooks/useNotificationFocusScroll';
import { buildAssetFocusElementId } from '@/utils/assetNotificationRouting';
import {
    formatAssetAssignmentStatusLine,
    getAssetStatusBadgeClass,
    isLeaveActive,
    isParkingStatus,
    isServiceActive,
    isServiceOperationalStatus,
} from '@/utils/assetStatusHelpers';

import { UserPlus, Square, CheckSquare, User, Users } from 'lucide-react';

import { sanitizeUrl } from '@/utils/security';
import { openAttachmentInNewTab } from '@/utils/attachmentPreview';

import AssignAssetModal from './components/AssignAssetModal';

import BulkAssignAssetModal from './components/BulkAssignAssetModal';
import BulkHolderActionModal from './components/BulkHolderActionModal';
import PendingAssetRequestsModal from './components/PendingAssetRequestsModal';
import OwnerOnDutyReviewModal from './components/OwnerOnDutyReviewModal';
import {
    countVisibleAssetPendingInbox,
    notifyAssetPendingInboxChanged,
} from './utils/assetPendingInboxCount';
import { fetchAssetPendingInbox } from '@/utils/pendingInboxFetch';
import BulkAssignmentAcknowledgeModal from './components/BulkAssignmentAcknowledgeModal';
import AssetListExportDialog from './components/AssetListExportDialog';
import { AssetListSummaryPanels } from './components/ListPageSummaryCards';
import {
    buildAssetActionUser,
    resolveAdminInCompanyFlowchart,
} from './utils/canPerformAssetAction';

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

const formatLostDate = (row) => {
    const item = row.item;
    let rawDate = null;
    if (row.kind === 'accessory') {
        const acc = row.accessory;
        rawDate = acc?.lostAt || acc?.detachedAt || item?.lostAt || null;
    } else {
        rawDate = item?.lostAt || null;
        if (!rawDate) {
            const statusNorm = String(item?.status || '').trim().toLowerCase().replace(/\s+/g, '');
            if (statusNorm === 'lost' || statusNorm === 'endoflife') {
                rawDate = item?.updatedAt || null;
            }
        }
    }
    if (!rawDate) return '—';
    try {
        return new Date(rawDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
};

const getLossDamageFineLinkLabel = (fineStatus) => {
    const isApproved = ['approved', 'active', 'completed', 'paid'].includes(
        String(fineStatus || '').toLowerCase().trim(),
    );
    return isApproved ? 'Approved' : 'Pending';
};

const ASSET_LIST_STATUS_FILTERS = [
    'MyAsset',
    'All',
    'Assigned',
    'Unassigned',
    'AwaitingApproval',
    'OnLeave',
    'OnService',
    'WarrantyYes',
    'Draft',
];

const ASSET_LIST_STATUS_LABELS = {
    MyAsset: 'My Assets',
    All: 'All Assets',
    Assigned: 'Assigned Assets',
    Unassigned: 'Unassigned Assets',
    AwaitingApproval: 'Awaiting Approval',
    OnLeave: 'Parking / On Leave',
    OnService: 'On Service',
    WarrantyYes: 'Warranty — Yes',
    Lost: 'Lost / Damaged Assets',
    EndOfLife: 'End of Life Assets',
    Draft: 'My Draft Assets',
};

const ASSET_LIST_DOWNLOAD_SCOPES = {
    MyAsset: 'MyAsset',
    All: 'All',
    Assigned: 'Assigned',
    Unassigned: 'Unassigned',
    AwaitingApproval: 'AwaitingApproval',
    OnLeave: 'OnLeave',
    OnService: 'OnService',
    WarrantyYes: 'WarrantyYes',
    Lost: 'Lost',
    EndOfLife: 'EndOfLife',
    Draft: 'Draft',
    AssetType: 'AssetType',
    AssetCategory: 'AssetCategory',
    Accessories: 'Accessories',
    LossDamage: 'LossDamage',
};

function resolveLoggedInEmployeeRecordId() {
    try {
        if (typeof window === 'undefined') return '';
        const employeeUser = JSON.parse(localStorage.getItem('employeeUser') || '{}');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const id =
            employeeUser?.employeeObjectId ||
            employeeUser?._id ||
            employeeUser?.id ||
            user?.employeeObjectId ||
            user?.empObjectId ||
            user?._id ||
            user?.id ||
            '';
        return id ? String(id) : '';
    } catch {
        return '';
    }
}

const LEGACY_ASSET_LIST_STATUS = {
    Pending: 'AwaitingApproval',
    PendingUnassigned: 'Unassigned',
    'On Leave': 'All',
    Maintenance: 'All',
    Service: 'OnService',
    'End of Life': 'EndOfLife',
    Returned: 'All',
    Rejected: 'Lost',
};

const LOSS_DAMAGE_STATUS_FILTERS = ['All', 'Lost', 'EndOfLife'];

const LEGACY_LOSS_DAMAGE_STATUS = {
    Rejected: 'Lost',
};

function normalizeLossDamageStatusFilter(raw) {
    if (!raw || raw === 'null' || raw === 'undefined') return 'All';
    const mapped = LEGACY_LOSS_DAMAGE_STATUS[raw] ?? raw;
    return LOSS_DAMAGE_STATUS_FILTERS.includes(mapped) ? mapped : 'All';
}

function normalizeAssetListStatusFilter(raw) {
    if (!raw || raw === 'null' || raw === 'undefined') return 'MyAsset';
    const mapped = LEGACY_ASSET_LIST_STATUS[raw] ?? raw;
    return ASSET_LIST_STATUS_FILTERS.includes(mapped) ? mapped : 'MyAsset';
}

const ASSET_LIST_PER_PAGE_OPTIONS = [10, 50, 100];

function parseAssetListPerPage(raw) {
    const parsed = parseInt(raw || '10', 10);
    return ASSET_LIST_PER_PAGE_OPTIONS.includes(parsed) ? parsed : 10;
}

function rowLooksLikeVehicleAsset(t) {
    const typeLower = String(t?.type || '').toLowerCase();
    const catLower = String(t?.category || '').toLowerCase();
    const plate = String(t?.plateNumber || '').trim();
    if (
        typeLower.includes('vehicle') ||
        typeLower.includes('car') ||
        typeLower.includes('van') ||
        typeLower.includes('pickup') ||
        typeLower.includes('fleet') ||
        typeLower.includes('truck')
    ) {
        return true;
    }
    if (catLower.includes('vehicle') || catLower.includes('fleet')) return true;
    if (plate) return true;
    return false;
}

function resolveAssetDetailHref(item) {
    if (!item?._id) return null;
    return rowLooksLikeVehicleAsset(item)
        ? `/HRM/Asset/Vehicle/details/${item._id}`
        : `/HRM/Asset/details/${item._id}`;
}

/** Build `/HRM/Asset?...` URLs for tools tabs / KPI filters / type→category drill-downs. */
function buildToolsAssetListHref({
    tab = 'asset',
    search = '',
    status = '',
    assignedTo = '',
    lossDamageStatus = '',
    view = '',
} = {}) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (status === 'Assigned' && assignedTo) params.set('assignedTo', assignedTo);
    if (tab && tab !== 'asset') params.set('tab', tab);
    if (view && view !== 'grid') params.set('view', view);
    if (lossDamageStatus && lossDamageStatus !== 'All') params.set('lossDamageStatus', lossDamageStatus);
    const qs = params.toString();
    return qs ? `/HRM/Asset?${qs}` : '/HRM/Asset';
}

function toolsSummaryCardHref(filterKey) {
    switch (filterKey) {
        case 'totalAsset':
        case 'totalAssetValue':
            return buildToolsAssetListHref({ status: 'All' });
        case 'assignedAsset':
        case 'assignedAssetValue':
        case 'assignedPeople':
            return buildToolsAssetListHref({ status: 'Assigned' });
        case 'unassignedAsset':
        case 'unassignedValue':
            return buildToolsAssetListHref({ status: 'Unassigned' });
        case 'lossDamageAsset':
        case 'lossDamageValue':
            return buildToolsAssetListHref({ tab: 'lossDamage', lossDamageStatus: 'All' });
        case 'parking':
            return buildToolsAssetListHref({ status: 'OnLeave' });
        case 'accessories':
            return buildToolsAssetListHref({ tab: 'accessories' });
        case 'warranty':
            return buildToolsAssetListHref({ status: 'WarrantyYes' });
        case 'assetType':
            return buildToolsAssetListHref({ tab: 'type' });
        case 'inService':
            return buildToolsAssetListHref({ status: 'OnService' });
        case 'pendingApproval':
            return buildToolsAssetListHref({ status: 'AwaitingApproval' });
        case 'assetCategory':
            return buildToolsAssetListHref({ tab: 'category' });
        default:
            return '';
    }
}

function openAssetDetailFromList(router, item, { tab } = {}) {
    const href = resolveAssetDetailHref(item);
    if (!href) return;
    const url = tab ? `${href}?tab=${encodeURIComponent(tab)}` : href;
    navigateFromList(router, url);
}

function isAssignmentAcknowledgmentOnly(t) {
    if ((t.acceptanceStatus || '') !== 'Pending') return false;
    if (t.pendingAction) return false;
    const s = t.status || '';
    if (s !== 'Pending' && s !== 'Assigned') return false;
    return !!(t.assignedTo || t.assignedCompany);
}

/** All assets waiting on an approval or assignee acknowledgment (shown under Awaiting Approval filter). */
function isAwaitingAssetApproval(t) {
    return isSubmittedForApproval(t) || isAssignmentAcknowledgmentOnly(t);
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

/**
 * Public "Awaiting Approval" excludes Drafts. Drafts are pre-submission and private to the
 * creator (matches `buildDraftVisibilityQuery` on the backend). Once submitted, the row
 * becomes status: 'Submitted for Approval' and is visible to the approver.
 */
function isSubmittedForApproval(t) {
    if (t.status === 'Submitted for Approval') return true;
    return (
        t.actionRequiredBy != null &&
        t.status === 'Pending' &&
        !isAssignmentAcknowledgmentOnly(t)
    );
}

function isAssetDraft(t) {
    return String(t?.status || '').trim() === 'Draft';
}

function isLostOrEndOfLifeAsset(t) {
    const low = String(t?.status || '').trim().toLowerCase();
    return low === 'lost' || low === 'rejected' || low === 'end of life' || low === 'endoflife';
}

function assetHasWarrantyYes(t) {
    if (Number(t?.warrantyYears) > 0) return true;
    const w = String(t?.warranty || '').trim().toLowerCase();
    return w === 'yes';
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

function resolveAssetListAssigneeStr(item) {
    if (item?.assignedCompany && typeof item.assignedCompany === 'object') {
        return (
            item.assignedCompany.nickName ||
            item.assignedCompany.companyShortName ||
            item.assignedCompany.name ||
            item.assignedCompany.companyName ||
            ''
        );
    }
    if (item?.assignedTo && typeof item.assignedTo === 'object') {
        const first = item.assignedTo.firstName || '';
        const last = item.assignedTo.lastName || '';
        if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
        return first || last;
    }
    return '';
}

function resolveAssetAssigneeId(item) {
    if (!item?.assignedTo || item?.assignedCompany) return '';
    const assignee = item.assignedTo;
    if (typeof assignee === 'object') {
        return String(assignee._id || assignee.id || assignee.employeeObjectId || '');
    }
    return String(assignee || '');
}

function resolveAssetCompanyId(item) {
    if (!item?.assignedCompany) return '';
    const company = item.assignedCompany;
    if (typeof company === 'object') {
        return String(company._id || company.id || company.companyId || '');
    }
    return String(company || '');
}

function resolveAssetCompanyLabel(item) {
    if (!item?.assignedCompany || typeof item.assignedCompany !== 'object') return 'Unknown Company';
    const company = item.assignedCompany;
    return (
        company.nickName ||
        company.companyShortName ||
        company.name ||
        company.companyName ||
        'Unknown Company'
    );
}

const ASSIGNED_FILTER_EMPLOYEE_PREFIX = 'employee:';
const ASSIGNED_FILTER_COMPANY_PREFIX = 'company:';

function parseAssignedToFilter(value) {
    const raw = String(value || '').trim();
    if (!raw) return { type: 'all' };
    if (raw.startsWith(ASSIGNED_FILTER_COMPANY_PREFIX)) {
        return { type: 'company', id: raw.slice(ASSIGNED_FILTER_COMPANY_PREFIX.length) };
    }
    if (raw.startsWith(ASSIGNED_FILTER_EMPLOYEE_PREFIX)) {
        return { type: 'employee', id: raw.slice(ASSIGNED_FILTER_EMPLOYEE_PREFIX.length) };
    }
    return { type: 'employee', id: raw };
}

function normalizeAssignedToFilterValue(value) {
    const parsed = parseAssignedToFilter(value);
    if (parsed.type === 'all') return '';
    if (parsed.type === 'company') return `${ASSIGNED_FILTER_COMPANY_PREFIX}${parsed.id}`;
    return `${ASSIGNED_FILTER_EMPLOYEE_PREFIX}${parsed.id}`;
}

function matchesAssignedToFilter(item, filterValue) {
    const parsed = parseAssignedToFilter(filterValue);
    if (parsed.type === 'all') return true;
    if (parsed.type === 'employee') return resolveAssetAssigneeId(item) === parsed.id;
    if (parsed.type === 'company') return resolveAssetCompanyId(item) === parsed.id;
    return true;
}

function resolveAssetOwnerGroupKey(item) {
    if (item?.assignedCompany) {
        const company = item.assignedCompany;
        if (typeof company === 'object') {
            return `company:${company._id || company.id || company.companyId || company.name || 'unknown'}`;
        }
        return `company:${company}`;
    }
    const employeeId = resolveAssetAssigneeId(item);
    if (employeeId) return `employee:${employeeId}`;
    return 'unassigned';
}

function countUniqueAssetOwners(rows) {
    return new Set((rows || []).map(resolveAssetOwnerGroupKey)).size;
}

function resolveAssetAssigneeLabel(item) {
    const assignee = item?.assignedTo;
    if (!assignee || typeof assignee !== 'object') return 'Unknown Employee';
    const name = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim();
    if (name) return name;
    return assignee.employeeId || 'Unknown Employee';
}

function resolveAssetAssigneeCode(item) {
    const assignee = item?.assignedTo;
    if (assignee && typeof assignee === 'object' && assignee.employeeId) {
        return String(assignee.employeeId);
    }
    return '';
}

function matchesAssetListStatusFilter(t, statusFilter) {
    const low = (t.status || '').toLowerCase();
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Assigned') {
        return t.status === 'Assigned' && !isAwaitingAssetApproval(t);
    }
    if (statusFilter === 'Unassigned') {
        return ['unassigned', 'available'].includes(low);
    }
    if (statusFilter === 'OnLeave') return isLeaveActive(t);
    if (statusFilter === 'OnService') return isServiceActive(t);
    if (statusFilter === 'WarrantyYes') return assetHasWarrantyYes(t);
    if (statusFilter === 'AwaitingApproval') return isAwaitingAssetApproval(t);
    if (statusFilter === 'Lost') {
        if (low === 'lost' || low === 'rejected') return true;
        return itemHasPendingLossDamage(t);
    }
    if (statusFilter === 'EndOfLife') return low === 'end of life' || low === 'endoflife';
    if (statusFilter === 'Draft') return isAssetDraft(t);
    return false;
}

/** Sort bucket for "All Assets": assigned → unassigned → awaiting approval → other */
function getAssetListSortBucket(item) {
    if (isAwaitingAssetApproval(item)) return 2;
    const low = String(item.status || '').toLowerCase();
    if (['unassigned', 'available'].includes(low)) return 1;
    const hasAssignee = !!(item?.assignedTo || item?.assignedCompany);
    if (item.status === 'Assigned' || (hasAssignee && !['draft'].includes(low))) return 0;
    return 3;
}

function getAssetListOwnerSortLabel(item) {
    if (item?.assignedCompany) return resolveAssetCompanyLabel(item);
    if (item?.assignedTo) return resolveAssetAssigneeLabel(item);
    return '';
}

function getAssetListOwnerSortKey(item) {
    const label = getAssetListOwnerSortLabel(item).trim().toLowerCase();
    return label || 'zzz_unassigned';
}

function compareAssetListRows(a, b, { groupByUser = false } = {}) {
    const bucketA = getAssetListSortBucket(a);
    const bucketB = getAssetListSortBucket(b);
    if (bucketA !== bucketB) return bucketA - bucketB;

    if (groupByUser && bucketA === 0) {
        const ownerCmp = getAssetListOwnerSortKey(a).localeCompare(getAssetListOwnerSortKey(b));
        if (ownerCmp !== 0) return ownerCmp;
    }

    const nameA = String(a.name || a.assetId || '').toLowerCase();
    const nameB = String(b.name || b.assetId || '').toLowerCase();
    return nameA.localeCompare(nameB) || String(a.assetId || '').localeCompare(String(b.assetId || ''));
}

function shouldGroupAssetListByUser(statusFilter) {
    return statusFilter === 'All' || statusFilter === 'Assigned';
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
    if (['lost', 'end of life', 'endoflife'].includes(mainStatus)) return true;
    if (Array.isArray(item?.lostDetachedAccessories) && item.lostDetachedAccessories.length > 0) return true;
    return Array.isArray(item?.accessories) && item.accessories.some((a) => {
        const s = String(a?.status || '').trim().toLowerCase();
        return ['lost', 'end of life', 'endoflife'].includes(s);
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
    return isAwaitingAssetApproval(item);
}

function formatAssetWorkflowActorLabel(ref) {
    if (!ref || typeof ref !== 'object') return '';
    const name = `${ref.firstName || ''} ${ref.lastName || ''}`.trim();
    return name || (ref.employeeId ? String(ref.employeeId) : '');
}

function getAssetListWaitingLabel(item) {
    if (isAssignmentAcknowledgmentOnly(item)) {
        const fromActionRequired = formatAssetWorkflowActorLabel(item.actionRequiredBy);
        if (fromActionRequired) return fromActionRequired;
        if (item.assignedCompany) return resolveAssetCompanyLabel(item);
        if (item.assignedTo) return resolveAssetAssigneeLabel(item);
        return 'Acknowledgment';
    }
    const ar = item.actionRequiredBy;
    const fromAr = formatAssetWorkflowActorLabel(ar);
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
    const [lossDamageSubTab, setLossDamageSubTab] = useState('assets');
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
    const [catalogDeleteTarget, setCatalogDeleteTarget] = useState(null);
    const [catalogDeleteLoading, setCatalogDeleteLoading] = useState(false);



    // Initialize from URL params (persists filters through back-navigation)

    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

    // Default: show assets assigned to logged-in user (self-owned tools/assets)
    const [statusFilter, setStatusFilter] = useState(() => normalizeAssetListStatusFilter(searchParams.get('status')));
    const [assignedToEmployeeFilter, setAssignedToEmployeeFilter] = useState(
        () => searchParams.get('assignedTo') || '',
    );
    const [downloadingAssetList, setDownloadingAssetList] = useState(false);
    const [assetListExportModalOpen, setAssetListExportModalOpen] = useState(false);

    const [assetListPage, setAssetListPage] = useState(() => {
        const parsed = parseInt(searchParams.get('page') || '1', 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    });
    const [assetListPerPage, setAssetListPerPage] = useState(() => parseAssetListPerPage(searchParams.get('perPage')));
    const skipAssetListPageResetRef = useRef(1);
    const isSyncingFromUrlRef = useRef(false);

    const [showFilters, setShowFilters] = useState(false);

    // Accessories Modal State

    const [accessoriesModalOpen, setAccessoriesModalOpen] = useState(false);

    const [selectedAssetForAccessories, setSelectedAssetForAccessories] = useState(null);



    // Bulk Assignment State

    const [selectionMode, setSelectionMode] = useState(false);

    const [selectedAssetIds, setSelectedAssetIds] = useState([]);

    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);

    const [bulkHolderModal, setBulkHolderModal] = useState({ open: false, mode: null }); // mode: 'return' | 'transfer'

    const [pendingInboxModalOpen, setPendingInboxModalOpen] = useState(false);
    const [ownerOnDutyReviewId, setOwnerOnDutyReviewId] = useState(null);

    const [pendingInboxCount, setPendingInboxCount] = useState(0);
    const toolsInboxWarmRef = useRef(false);

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

    const [deleteConfirm, setDeleteConfirm] = useState({
        isOpen: false,
        assetId: null,
        assetName: '',
        mode: 'asset',
        accessory: null,
    });

    const [assetRoleMeta, setAssetRoleMeta] = useState({
        isAdmin: false,
        isAssetController: false,
        canDirectAddAsset: false
    });
    const [assetActionEmployee, setAssetActionEmployee] = useState(null);
    const [companyResponsibilities, setCompanyResponsibilities] = useState([]);

    /** When set, AddAssetTypeModal opens in edit mode for a type or category row */
    const [typeCategoryEditInitial, setTypeCategoryEditInitial] = useState(null);

    const canAddTypeCategory = assetRoleMeta.isAdmin === true;
    const canEditTypeCategory = assetRoleMeta.isAdmin === true || assetRoleMeta.isAssetController === true;
    const canDeleteTypeCategory = assetRoleMeta.isAdmin === true;
    const canAssignUnassignedAssets = assetRoleMeta.isAdmin === true || assetRoleMeta.isAssetController === true;

    const accessoriesAssetActionUser = useMemo(() => {
        if (!selectedAssetForAccessories || !assetActionEmployee) return null;
        return buildAssetActionUser({
            employeeObjectId: assetActionEmployee._id || assetActionEmployee.id,
            isAssetController: assetRoleMeta.isAssetController === true,
            isAdminInCompanyFlowchart: resolveAdminInCompanyFlowchart(
                assetActionEmployee,
                selectedAssetForAccessories,
                companyResponsibilities,
            ),
            isSystemAdmin: isAdmin() || assetRoleMeta.isAdmin === true,
        });
    }, [selectedAssetForAccessories, assetActionEmployee, assetRoleMeta.isAssetController, companyResponsibilities]);

    // Keep latest query string without listing `searchParams` as an effect dep — including it caused
    // replaceState → Next invalidates searchParams → effect again → main-thread flood + Chrome violations.

    const searchParamsRef = useRef(searchParams);

    searchParamsRef.current = searchParams;

    const listReturnParams = useMemo(() => ({
        search: searchQuery,
        status: statusFilter,
        ...(statusFilter === 'Assigned' && assignedToEmployeeFilter ? { assignedTo: assignedToEmployeeFilter } : {}),
        ...(activeTab !== 'asset' ? { tab: activeTab } : {}),
        ...(viewMode !== 'grid' ? { view: viewMode } : {}),
        ...(lossDamageStatusFilter !== 'All' ? { lossDamageStatus: lossDamageStatusFilter } : {}),
        ...(assetListPage > 1 ? { page: assetListPage } : {}),
        ...(assetListPerPage !== 10 ? { perPage: assetListPerPage } : {}),
    }), [
        searchQuery,
        statusFilter,
        assignedToEmployeeFilter,
        activeTab,
        viewMode,
        lossDamageStatusFilter,
        assetListPage,
        assetListPerPage,
    ]);

    usePersistListReturnState(listReturnParams);



    // Sync state from URL when navigating back/forward (layout phase so stale state cannot clobber URL in the follow-up effect)

    useLayoutEffect(() => {

        isSyncingFromUrlRef.current = true;

        const getParam = (key, fallback = '') => {

            const val = searchParams.get(key);

            if (!val || val === 'null' || val === 'undefined') return fallback;

            return val;

        };

        const nextSearch = getParam('search');

        const urlStatus = normalizeAssetListStatusFilter(getParam('status', ''));
        const urlTab = getParam('tab');
        const urlView = getParam('view');
        const urlLossDamageStatus = getParam('lossDamageStatus');

        setSearchQuery((prev) => (prev === nextSearch ? prev : nextSearch));

        setStatusFilter((prev) => (prev === urlStatus ? prev : urlStatus));

        const urlAssignedTo = getParam('assignedTo');
        setAssignedToEmployeeFilter((prev) => (prev === urlAssignedTo ? prev : urlAssignedTo));

        if (urlTab) setActiveTab((prev) => (prev === urlTab ? prev : urlTab));
        if (urlView) setViewMode((prev) => (prev === urlView ? prev : urlView));

        const normalizedLossDamageStatus = normalizeLossDamageStatusFilter(urlLossDamageStatus);
        if (urlLossDamageStatus) {
            setLossDamageStatusFilter((prev) => (prev === normalizedLossDamageStatus ? prev : normalizedLossDamageStatus));
        }

        const pageParam = searchParams.get('page');
        const parsedPage = pageParam ? parseInt(pageParam, 10) : 1;
        const nextPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
        setAssetListPage((prev) => (prev === nextPage ? prev : nextPage));

        const nextPerPage = parseAssetListPerPage(searchParams.get('perPage'));
        setAssetListPerPage((prev) => (prev === nextPerPage ? prev : nextPerPage));

        if (urlStatus && urlStatus !== 'All') {

            setShowFilters(true);

        }

        queueMicrotask(() => {
            isSyncingFromUrlRef.current = false;
        });

    }, [searchParams]);

    useEffect(() => {
        const reviewId = searchParams.get('ownerOnDutyReview');
        if (reviewId) {
            setOwnerOnDutyReviewId(reviewId);
        }
    }, [searchParams]);

    // Write filters to URL so back-button preserves them (other params e.g. bulkAssignmentGroup preserved)

    useEffect(() => {

        const params = new URLSearchParams(searchParamsRef.current.toString());

        if (searchQuery) params.set('search', searchQuery);
        else params.delete('search');

        if (statusFilter) params.set('status', statusFilter);
        else params.delete('status');

        if (statusFilter === 'Assigned' && assignedToEmployeeFilter) {
            params.set('assignedTo', normalizeAssignedToFilterValue(assignedToEmployeeFilter));
        } else {
            params.delete('assignedTo');
        }

        if (activeTab && activeTab !== 'asset') params.set('tab', activeTab);
        else params.delete('tab');

        if (viewMode && viewMode !== 'grid') params.set('view', viewMode);
        else params.delete('view');

        if (lossDamageStatusFilter && lossDamageStatusFilter !== 'All') params.set('lossDamageStatus', lossDamageStatusFilter);
        else params.delete('lossDamageStatus');

        if (assetListPage > 1) params.set('page', String(assetListPage));
        else params.delete('page');

        if (assetListPerPage !== 10) params.set('perPage', String(assetListPerPage));
        else params.delete('perPage');

        const queryString = params.toString();

        const newUrl = queryString ? `/HRM/Asset?${queryString}` : '/HRM/Asset';

        const currentFull = `${window.location.pathname}${window.location.search}`;

        if (newUrl === currentFull) return;

        rememberListFilterStep(newUrl);

    }, [searchQuery, statusFilter, assignedToEmployeeFilter, activeTab, viewMode, lossDamageStatusFilter, assetListPage, assetListPerPage]);

    useEffect(() => {
        if (statusFilter !== 'Assigned' && assignedToEmployeeFilter) {
            setAssignedToEmployeeFilter('');
        }
    }, [statusFilter, assignedToEmployeeFilter]);

    useEffect(() => {

        setMounted(true);

        fetchAssetTypes();

    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await axiosInstance.get('/AssetType/meta/role', { skipToast: true });
                if (!cancelled && r?.data) {
                    setAssetRoleMeta(r.data);
                    setCachedAssetFlowchartRoleMeta(r.data);
                }
            } catch {
                /* non-fatal */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [userRes, companyRes] = await Promise.all([
                    axiosInstance.get('/Employee/me'),
                    axiosInstance.get('/Company', { params: { scope: 'responsibilities' } }),
                ]);
                if (cancelled) return;
                if (userRes?.data) setAssetActionEmployee(userRes.data);
                setCompanyResponsibilities(companyRes.data?.companies || []);
            } catch {
                /* non-fatal */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchPendingInboxCount = useCallback(async ({ force = false } = {}) => {
        try {
            const items = await fetchAssetPendingInbox(axiosInstance, {
                inboxScope: 'tools',
                skipSync: !force,
                skipToast: true,
                force,
            });
            setPendingInboxCount(countVisibleAssetPendingInbox(items));
            notifyAssetPendingInboxChanged();
        } catch {
            setPendingInboxCount(0);
            notifyAssetPendingInboxChanged();
        }
    }, []);

    const warmToolsInboxBadge = useCallback(() => {
        if (toolsInboxWarmRef.current) return;
        toolsInboxWarmRef.current = true;
        fetchPendingInboxCount();
    }, [fetchPendingInboxCount]);

    useEffect(() => {
        if (!mounted || activeTab !== 'asset') return;
        fetchPendingInboxCount();
        const intervalId = setInterval(fetchPendingInboxCount, 5 * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [mounted, activeTab, fetchPendingInboxCount]);



    const fetchAssetTypes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/AssetType', { params: { scope: 'tools' } });
            setAssetTypes(response.data);
        } catch (error) {
            if (!isSessionAuthError(error)) {
            }
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
                    !rowLooksLikeVehicleAsset(t)
            ),
        [assetTypes]
    );

    const assignedEmployeeOptions = useMemo(() => {
        const byId = new Map();
        nonVehicleAssetRows.forEach((item) => {
            if (item.status !== 'Assigned' || item.assignedCompany) return;
            const id = resolveAssetAssigneeId(item);
            if (!id) return;
            if (!byId.has(id)) {
                byId.set(id, {
                    id,
                    name: resolveAssetAssigneeLabel(item),
                    employeeId: resolveAssetAssigneeCode(item),
                });
            }
        });
        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [nonVehicleAssetRows]);

    const assignedCompanyOptions = useMemo(() => {
        const byId = new Map();
        nonVehicleAssetRows.forEach((item) => {
            if (item.status !== 'Assigned' || !item.assignedCompany) return;
            const id = resolveAssetCompanyId(item);
            if (!id) return;
            if (!byId.has(id)) {
                byId.set(id, {
                    id,
                    name: resolveAssetCompanyLabel(item),
                });
            }
        });
        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [nonVehicleAssetRows]);

    const normalizedAssignedToFilter = useMemo(
        () => normalizeAssignedToFilterValue(assignedToEmployeeFilter),
        [assignedToEmployeeFilter],
    );

    const filteredAssetTableRows = useMemo(() => {
        const q = (deferredSearchQuery || '').toLowerCase().trim();
        const { primaryLoggedInUserId, loggedInEmployeeIds } = (() => {
            try {
                if (typeof window === 'undefined') return { primaryLoggedInUserId: '', loggedInEmployeeIds: new Set() };
                const employeeUser = JSON.parse(localStorage.getItem('employeeUser') || '{}');
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const ids = [
                    employeeUser?._id,
                    employeeUser?.id,
                    employeeUser?.employeeObjectId,
                    employeeUser?.employeeId,
                    user?._id,
                    user?.id,
                    user?.employeeObjectId,
                    user?.employeeId,
                ]
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

        return nonVehicleAssetRows.filter((t) => {
            const matchesSearch =
                !q ||
                t.name?.toLowerCase().includes(q) ||
                t.assetId?.toLowerCase().includes(q) ||
                t.category?.toLowerCase().includes(q) ||
                t.type?.toLowerCase().includes(q);

            // Drafts are private to their creator. The backend already enforces this via
            // buildDraftVisibilityQuery, so anything reaching the client with status='Draft' is
            // implicitly the viewer's own. We only block here when we can positively prove the
            // row was created by a different user (createdBy populated AND not mine).
            if (isAssetDraft(t)) {
                const creatorRef = t.createdBy && typeof t.createdBy === 'object' ? t.createdBy._id : t.createdBy;
                const creatorId = creatorRef ? String(creatorRef) : '';
                if (creatorId && loggedInEmployeeIds.size > 0 && !loggedInEmployeeIds.has(creatorId)) {
                    return false;
                }
            }

            let matchesStatus = matchesAssetListStatusFilter(t, statusFilter);

            if (statusFilter === 'MyAsset') {
                const assignedToIdRaw =
                    (t.assignedTo && typeof t.assignedTo === 'object')
                        ? (t.assignedTo._id || t.assignedTo.id || t.assignedTo.employeeObjectId || t.assignedTo.employeeId || '')
                        : (t.assignedTo || '');
                const assignedToId = String(assignedToIdRaw || '');
                const isCompanyAssigned = !!t.assignedCompany;
                matchesStatus =
                    loggedInEmployeeIds.size > 0 &&
                    assignedToId &&
                    loggedInEmployeeIds.has(assignedToId) &&
                    !isCompanyAssigned;
            }

            if (statusFilter === 'Assigned' && assignedToEmployeeFilter) {
                matchesStatus = matchesStatus && matchesAssignedToFilter(t, assignedToEmployeeFilter);
            }

            return matchesSearch && matchesStatus;
        });
    }, [nonVehicleAssetRows, deferredSearchQuery, statusFilter, assignedToEmployeeFilter]);

    const sortedFilteredAssetTableRows = useMemo(() => {
        const rows = [...filteredAssetTableRows];
        const groupByUser = shouldGroupAssetListByUser(statusFilter);
        rows.sort((a, b) => compareAssetListRows(a, b, { groupByUser }));
        return rows;
    }, [filteredAssetTableRows, statusFilter]);

    const assetListPagination = useMemo(() => {
        const totalItems = sortedFilteredAssetTableRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / assetListPerPage));
        const currentPage = Math.min(assetListPage, totalPages);
        const startIndex = (currentPage - 1) * assetListPerPage;
        const endIndex = startIndex + assetListPerPage;
        return {
            totalItems,
            totalPages,
            currentPage,
            startIndex,
            endIndex,
            paginatedRows: sortedFilteredAssetTableRows.slice(startIndex, endIndex),
        };
    }, [sortedFilteredAssetTableRows, assetListPerPage, assetListPage]);

    useEffect(() => {
        if (assetListPage > assetListPagination.totalPages) {
            setAssetListPage(assetListPagination.totalPages);
        }
    }, [assetListPage, assetListPagination.totalPages]);

    useEffect(() => {
        if (skipAssetListPageResetRef.current > 0) {
            skipAssetListPageResetRef.current -= 1;
            return;
        }
        if (isSyncingFromUrlRef.current) {
            return;
        }
        setAssetListPage(1);
    }, [deferredSearchQuery, statusFilter, assignedToEmployeeFilter]);

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
            const mainDamageStatus = ['lost', 'end of life', 'endoflife'].includes(mainStatusNorm);
            const mainPending = t?.pendingAction === 'Loss and Damage';

            // Row for main asset (pending or loss/damage statuses)
            if (mainPending || mainDamageStatus) {
                rows.push({ kind: 'asset', item: t });
            }

            // Rows for each accessory (pending or loss/damage statuses)
            (t.accessories || []).forEach((acc) => {
                const accStatus = String(acc?.status || '').trim();
                const accStatusNorm = accStatus.toLowerCase();
                const accDamageStatus = ['lost', 'end of life', 'endoflife'].includes(accStatusNorm);
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
                        fineId: log?.fineId,
                        fineStatus: log?.fineStatus,
                        detachedAt: log?.detachedAt,
                        lostAt: log?.lostAt,
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
                (lossDamageStatusFilter === 'EndOfLife' && (statusNorm === 'end of life' || statusNorm === 'endoflife'));

            if (!matchesStatus) return false;

            // Filter by sub-tab!
            if (lossDamageSubTab === 'assets' && row.kind !== 'asset') return false;
            if (lossDamageSubTab === 'accessories' && row.kind !== 'accessory') return false;

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
    }, [assetTypes, searchQuery, lossDamageStatusFilter, lossDamageSubTab]);

    useNotificationFocusScroll({
        loading,
        deps: [
            activeTab,
            statusFilter,
            lossDamageStatusFilter,
            lossDamageSubTab,
            filteredAssetTableRows.length,
            lossDamageListRows.length,
        ],
    });

    const handleDeleteAsset = useCallback(async () => {
        if (!deleteConfirm.assetId) return;
        try {
            if (deleteConfirm.mode === 'accessory' && deleteConfirm.accessory) {
                const parent = assetTypes
                    .flatMap((t) => t.items || [])
                    .find((a) => String(a._id) === String(deleteConfirm.assetId));
                if (!parent) {
                    throw new Error('Parent asset not found');
                }
                const target = deleteConfirm.accessory;
                const updatedAccessories = (parent.accessories || []).filter(
                    (a) => String(a._id) !== String(target._id),
                );
                await axiosInstance.put(`/AssetType/${deleteConfirm.assetId}`, {
                    accessories: updatedAccessories,
                });
                toast({
                    title: 'Deleted',
                    description: `"${target.name || target.accessoryId || 'Accessory'}" removed.`,
                });
            } else {
                await axiosInstance.delete(`/AssetType/${deleteConfirm.assetId}`);
                toast({ title: 'Deleted', description: 'Item removed.' });
            }
            setDeleteConfirm({ isOpen: false, assetId: null, assetName: '', mode: 'asset', accessory: null });
            fetchAssetTypes();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Delete failed',
                description: e?.response?.data?.message || e?.message || 'Could not delete.'
            });
        }
    }, [deleteConfirm, assetTypes, fetchAssetTypes, toast]);



    const fetchAccessoryCatalog = useCallback(async () => {

        try {

            setLoadingAccessoryCatalog(true);

            const response = await axiosInstance.get('/AssetAccessoryCatalog');

            setAccessoryCatalog(Array.isArray(response.data) ? response.data : []);

        } catch (error) {

            toast({ variant: 'destructive', title: 'Error', description: 'Could not load accessories catalog' });

        } finally {

            setLoadingAccessoryCatalog(false);

        }

    }, [toast]);

    useEffect(() => {

        fetchAccessoryCatalog();

    }, [fetchAccessoryCatalog]);

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

    const typeTabDownloadAssets = useMemo(() => {
        const q = (deferredSearchQuery || '').toLowerCase().trim();
        const visibleTypeNames = new Set(
            assetTypes
                .filter((t) => t.assetId?.startsWith('asset-type-'))
                .filter(
                    (type) =>
                        !q ||
                        type.type?.toLowerCase().includes(q) ||
                        type.category?.toLowerCase().includes(q) ||
                        type.assetId?.toLowerCase().includes(q),
                )
                .map((type) => type.type)
                .filter(Boolean),
        );
        if (!visibleTypeNames.size) return [];
        return nonVehicleAssetRows.filter((asset) => visibleTypeNames.has(asset.type));
    }, [assetTypes, deferredSearchQuery, nonVehicleAssetRows]);

    const categoryTabDownloadAssets = useMemo(() => {
        const q = (deferredSearchQuery || '').toLowerCase().trim();
        const officialCats = assetTypes.filter((t) => t.assetId?.startsWith('asset-cat-'));
        const categories = officialCats.reduce((acc, cat) => {
            acc[cat.category] = {
                name: cat.category,
                typeNames: cat.type ? [cat.type] : [],
            };
            return acc;
        }, {});

        assetTypes.forEach((curr) => {
            const cat = categories[curr.category];
            if (!cat) return;
            if (curr.type && curr.type !== '-' && !cat.typeNames.includes(curr.type)) {
                cat.typeNames.push(curr.type);
            }
        });

        const visibleCategoryNames = new Set(
            Object.values(categories)
                .filter(
                    (category) =>
                        !q ||
                        category.name.toLowerCase().includes(q) ||
                        (category.typeNames || []).some((typeName) => typeName.toLowerCase().includes(q)),
                )
                .map((category) => category.name),
        );
        if (!visibleCategoryNames.size) return [];
        return nonVehicleAssetRows.filter((asset) => visibleCategoryNames.has(asset.category));
    }, [assetTypes, deferredSearchQuery, nonVehicleAssetRows]);

    const accessoriesTabDownloadAssets = useMemo(() => {
        const assetsById = new Map(
            nonVehicleAssetRows.map((asset) => [String(asset._id || asset.id), asset]),
        );
        const seen = new Set();
        const rows = [];

        accessoryCatalogFiltered.forEach((catalogRow) => {
            const assetObjectId = catalogRow?.assetItemId?._id || catalogRow?.assetItemId;
            if (!assetObjectId) return;
            const key = String(assetObjectId);
            if (seen.has(key)) return;
            const asset = assetsById.get(key);
            if (!asset) return;
            seen.add(key);
            rows.push(asset);
        });

        return rows;
    }, [accessoryCatalogFiltered, nonVehicleAssetRows]);

    const lossDamageDownloadAssets = useMemo(() => {
        const seen = new Set();
        const rows = [];

        lossDamageListRows.forEach((entry) => {
            const assetId = entry.item?._id || entry.item?.id;
            if (!assetId) return;
            const key = String(assetId);
            if (seen.has(key)) return;
            seen.add(key);
            rows.push(entry.item);
        });

        return rows;
    }, [lossDamageListRows]);

    const activeTabDownloadAssets = useMemo(() => {
        switch (activeTab) {
            case 'asset':
                return sortedFilteredAssetTableRows;
            case 'type':
                return typeTabDownloadAssets;
            case 'category':
                return categoryTabDownloadAssets;
            case 'accessories':
                return accessoriesTabDownloadAssets;
            case 'lossDamage':
                return lossDamageDownloadAssets;
            default:
                return [];
        }
    }, [
        activeTab,
        filteredAssetTableRows,
        sortedFilteredAssetTableRows,
        typeTabDownloadAssets,
        categoryTabDownloadAssets,
        accessoriesTabDownloadAssets,
        lossDamageDownloadAssets,
    ]);

    const handleDownloadAssetList = useCallback(async ({
        format = 'pdf',
        columns = [],
        groupByOwner = false,
    } = {}) => {
        const downloadRows = activeTabDownloadAssets;
        const assetIds = downloadRows.map((row) => row?._id || row?.id).filter(Boolean);
        if (!assetIds.length) {
            toast({
                variant: 'destructive',
                title: 'No assets',
                description:
                    activeTab === 'accessories'
                        ? 'No attached assets in this accessories list to download.'
                        : 'There are no assets in this list to download.',
            });
            return;
        }

        if (!columns.length) {
            toast({
                variant: 'destructive',
                title: 'No columns selected',
                description: 'Select at least one column to include in the download.',
            });
            return;
        }

        const exportFormat = format === 'excel' ? 'excel' : 'pdf';
        const params = {
            assetIds: assetIds.join(','),
            columns: columns.join(','),
        };
        if (exportFormat === 'pdf' && groupByOwner) {
            params.groupByOwner = 'true';
        }
        let fileSuffix = 'AssetList';

        if (activeTab === 'asset') {
            const scope = ASSET_LIST_DOWNLOAD_SCOPES[statusFilter] || statusFilter;
            params.scope = scope;
            fileSuffix = scope;

            if (statusFilter === 'Assigned' && assignedToEmployeeFilter) {
                const parsed = parseAssignedToFilter(assignedToEmployeeFilter);
                if (parsed.type === 'company') {
                    const selected = assignedCompanyOptions.find((c) => c.id === parsed.id);
                    params.listTitle = `Assigned - ${selected?.name || 'Company'}`;
                    fileSuffix = String(selected?.name || parsed.id).replace(/[^\w.-]+/g, '_');
                } else {
                    params.employeeId = parsed.id;
                    const selected = assignedEmployeeOptions.find((e) => e.id === parsed.id);
                    fileSuffix = String(selected?.employeeId || parsed.id).replace(/[^\w.-]+/g, '_');
                }
            } else if (statusFilter === 'MyAsset') {
                const assigneeFromList = downloadRows
                    .map((row) => resolveAssetAssigneeId(row))
                    .find(Boolean);
                const loggedInEmployeeId = assigneeFromList || resolveLoggedInEmployeeRecordId();
                params.listTitle = ASSET_LIST_STATUS_LABELS.MyAsset;
                if (loggedInEmployeeId) {
                    params.employeeId = loggedInEmployeeId;
                }
            } else {
                params.listTitle = ASSET_LIST_STATUS_LABELS[statusFilter] || statusFilter;
            }
        } else if (activeTab === 'type') {
            params.scope = ASSET_LIST_DOWNLOAD_SCOPES.AssetType;
            params.listTitle = 'Asset Type List';
            fileSuffix = 'AssetType';
        } else if (activeTab === 'category') {
            params.scope = ASSET_LIST_DOWNLOAD_SCOPES.AssetCategory;
            params.listTitle = 'Asset Category List';
            fileSuffix = 'AssetCategory';
        } else if (activeTab === 'accessories') {
            const filterLabel =
                ACCESSORY_CATALOG_STATUS_FILTER_OPTIONS.find((opt) => opt.value === accessoryCatalogStatusFilter)
                    ?.label || 'Accessories';
            params.scope = ASSET_LIST_DOWNLOAD_SCOPES.Accessories;
            params.listTitle = `Accessories - ${filterLabel}`;
            fileSuffix = 'Accessories';
        } else if (activeTab === 'lossDamage') {
            params.scope =
                lossDamageStatusFilter === 'All'
                    ? ASSET_LIST_DOWNLOAD_SCOPES.LossDamage
                    : `LossDamage-${lossDamageStatusFilter}`;
            params.listTitle =
                lossDamageStatusFilter === 'All'
                    ? 'Loss & Damage Assets'
                    : `Loss & Damage - ${lossDamageStatusFilter}`;
            fileSuffix = String(params.scope).replace(/[^\w.-]+/g, '_');
        }

        if (params.groupByOwner === 'true' && params.listTitle) {
            fileSuffix = `${fileSuffix}-ByOwner`;
        }

        const endpoint =
            exportFormat === 'excel' ? '/AssetItem/asset-list/excel' : '/AssetItem/asset-list/pdf';
        const extension = exportFormat === 'excel' ? 'xls' : 'pdf';

        try {
            setDownloadingAssetList(true);
            const response = await axiosInstance.get(endpoint, {
                params,
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `AssetList-${fileSuffix}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setAssetListExportModalOpen(false);
        } catch (error) {
            console.error(`Asset list ${exportFormat} download failed:`, error);
            let description =
                exportFormat === 'excel'
                    ? 'Could not generate asset list Excel.'
                    : 'Could not generate asset list PDF.';
            const responseData = error?.response?.data;
            if (responseData instanceof Blob) {
                try {
                    const text = await responseData.text();
                    const parsed = JSON.parse(text);
                    if (parsed?.message) description = parsed.message;
                } catch {
                    /* ignore blob parse errors */
                }
            } else if (error?.message && !String(error.message).startsWith('Server error:')) {
                description = error.message;
            } else if (responseData?.message) {
                description = responseData.message;
            }
            toast({
                variant: 'destructive',
                title: 'Download failed',
                description,
            });
        } finally {
            setDownloadingAssetList(false);
        }
    }, [
        activeTab,
        activeTabDownloadAssets,
        statusFilter,
        assignedToEmployeeFilter,
        assignedEmployeeOptions,
        assignedCompanyOptions,
        accessoryCatalogStatusFilter,
        lossDamageStatusFilter,
        toast,
    ]);

    const assetListExportHasMultipleOwners = useMemo(
        () => countUniqueAssetOwners(activeTabDownloadAssets) > 1,
        [activeTabDownloadAssets],
    );

    const handleDownloadAssetListClick = useCallback(() => {
        const downloadRows = activeTabDownloadAssets;
        const assetIds = downloadRows.map((row) => row?._id || row?.id).filter(Boolean);
        if (!assetIds.length) {
            toast({
                variant: 'destructive',
                title: 'No assets',
                description:
                    activeTab === 'accessories'
                        ? 'No attached assets in this accessories list to download.'
                        : 'There are no assets in this list to download.',
            });
            return;
        }
        setAssetListExportModalOpen(true);
    }, [activeTab, activeTabDownloadAssets, toast]);

    const toolsListStats = useMemo(() => {
        const rows = assetTypes.filter(
            (t) => t.assetId?.startsWith('VEGA-ASSET-') && !rowLooksLikeVehicleAsset(t),
        );
        const st = (t) => String(t?.status || '').trim().toLowerCase();
        const activeRows = rows.filter((t) => !isLostOrEndOfLifeAsset(t));

        const assignedRows = rows.filter((t) => t.status === 'Assigned' && !isAwaitingAssetApproval(t));
        const unassignedRows = rows.filter((t) => {
            const low = st(t);
            return ['unassigned', 'available'].includes(low);
        });
        const ldRows = rows.filter((t) => itemHasAnyLossDamage(t));

        const sumVal = (arr) => arr.reduce((acc, t) => acc + (Number(t.assetValue) || 0), 0);

        const parkingRows = rows.filter((t) => isLeaveActive(t));
        const accessoryCount = accessoryCatalog.length;
        const warRows = rows.filter((t) => assetHasWarrantyYes(t));
        const typeDefinitionsCount = assetTypes.filter((t) => t.assetId?.startsWith('asset-type-')).length;
        const inServiceRows = rows.filter((t) => isServiceActive(t));
        const pendingRows = rows.filter((t) => isAwaitingAssetApproval(t));
        const assigneeIds = new Set();
        assignedRows.forEach((t) => {
            const raw =
                t.assignedTo && typeof t.assignedTo === 'object'
                    ? t.assignedTo._id || t.assignedTo.employeeObjectId || t.assignedTo.employeeId
                    : t.assignedTo;
            if (raw) assigneeIds.add(String(raw));
        });
        const categoryDefinitionsCount = assetTypes.filter((t) => t.assetId?.startsWith('asset-cat-')).length;

        return {
            total: activeRows.length,
            totalVal: sumVal(activeRows),
            assigned: assignedRows.length,
            assignedVal: sumVal(assignedRows),
            unassigned: unassignedRows.length,
            unassignedVal: sumVal(unassignedRows),
            lossDamage: ldRows.length,
            lossDamageVal: sumVal(ldRows),
            parking: parkingRows.length,
            accessories: accessoryCount,
            warranty: warRows.length,
            assetTypesDistinct: typeDefinitionsCount,
            inService: inServiceRows.length,
            pendingApproval: pendingRows.length,
            assignedPeople: assigneeIds.size,
            categoriesDistinct: categoryDefinitionsCount,
        };
    }, [assetTypes, accessoryCatalog]);

    const handleSummaryCardClick = useCallback((filterKey) => {
        setShowFilters(true);
        setSearchQuery('');
        setAssignedToEmployeeFilter('');

        switch (filterKey) {
            case 'totalAsset':
            case 'totalAssetValue':
                setActiveTab('asset');
                setStatusFilter('All');
                break;
            case 'assignedAsset':
            case 'assignedAssetValue':
            case 'assignedPeople':
                setActiveTab('asset');
                setStatusFilter('Assigned');
                break;
            case 'unassignedAsset':
            case 'unassignedValue':
                setActiveTab('asset');
                setStatusFilter('Unassigned');
                break;
            case 'lossDamageAsset':
            case 'lossDamageValue':
                setActiveTab('lossDamage');
                setLossDamageStatusFilter('All');
                setLossDamageSubTab('assets');
                break;
            case 'parking':
                setActiveTab('asset');
                setStatusFilter('OnLeave');
                break;
            case 'accessories':
                setActiveTab('accessories');
                setAccessoryCatalogStatusFilter('all');
                break;
            case 'warranty':
                setActiveTab('asset');
                setStatusFilter('WarrantyYes');
                break;
            case 'assetType':
                setActiveTab('type');
                break;
            case 'inService':
                setActiveTab('asset');
                setStatusFilter('OnService');
                break;
            case 'pendingApproval':
                setActiveTab('asset');
                setStatusFilter('AwaitingApproval');
                break;
            case 'assetCategory':
                setActiveTab('category');
                break;
            default:
                break;
        }
    }, []);

    const isSummaryCardActive = useCallback(
        (filterKey) => {
            switch (filterKey) {
                case 'totalAsset':
                case 'totalAssetValue':
                    return activeTab === 'asset' && statusFilter === 'All';
                case 'assignedAsset':
                case 'assignedAssetValue':
                    return activeTab === 'asset' && statusFilter === 'Assigned' && !assignedToEmployeeFilter;
                case 'assignedPeople':
                    return activeTab === 'asset' && statusFilter === 'Assigned';
                case 'unassignedAsset':
                case 'unassignedValue':
                    return activeTab === 'asset' && statusFilter === 'Unassigned';
                case 'lossDamageAsset':
                case 'lossDamageValue':
                    return activeTab === 'lossDamage' && lossDamageStatusFilter === 'All';
                case 'parking':
                    return activeTab === 'asset' && statusFilter === 'OnLeave';
                case 'accessories':
                    return activeTab === 'accessories';
                case 'warranty':
                    return activeTab === 'asset' && statusFilter === 'WarrantyYes';
                case 'assetType':
                    return activeTab === 'type';
                case 'inService':
                    return activeTab === 'asset' && statusFilter === 'OnService';
                case 'pendingApproval':
                    return activeTab === 'asset' && statusFilter === 'AwaitingApproval';
                case 'assetCategory':
                    return activeTab === 'category';
                default:
                    return false;
            }
        },
        [activeTab, statusFilter, assignedToEmployeeFilter, lossDamageStatusFilter],
    );

    const toolsSummaryLeftCards = useMemo(
        () => [
            { label: 'Total Asset', value: toolsListStats.total, filterKey: 'totalAsset', href: toolsSummaryCardHref('totalAsset') },
            { label: 'Assigned Asset', value: toolsListStats.assigned, filterKey: 'assignedAsset', href: toolsSummaryCardHref('assignedAsset') },
            { label: 'Unassigned Asset', value: toolsListStats.unassigned, filterKey: 'unassignedAsset', href: toolsSummaryCardHref('unassignedAsset') },
            { label: 'Loss & Damage Asset', value: toolsListStats.lossDamage, filterKey: 'lossDamageAsset', href: toolsSummaryCardHref('lossDamageAsset') },
            { label: 'Total Asset Value', value: toolsListStats.totalVal, suffix: 'AED', filterKey: 'totalAssetValue', href: toolsSummaryCardHref('totalAssetValue') },
            { label: 'Assigned Asset Value', value: toolsListStats.assignedVal, suffix: 'AED', filterKey: 'assignedAssetValue', href: toolsSummaryCardHref('assignedAssetValue') },
            { label: 'Unassigned Value', value: toolsListStats.unassignedVal, suffix: 'AED', filterKey: 'unassignedValue', href: toolsSummaryCardHref('unassignedValue') },
            { label: 'Loss & Damage Value', value: toolsListStats.lossDamageVal, suffix: 'AED', filterKey: 'lossDamageValue', href: toolsSummaryCardHref('lossDamageValue') },
        ],
        [toolsListStats],
    );

    const toolsSummaryRightCards = useMemo(
        () => [
            { label: 'Parking', value: toolsListStats.parking, filterKey: 'parking', href: toolsSummaryCardHref('parking') },
            { label: 'Accessories', value: toolsListStats.accessories, filterKey: 'accessories', href: toolsSummaryCardHref('accessories') },
            { label: 'Warranty', value: toolsListStats.warranty, filterKey: 'warranty', href: toolsSummaryCardHref('warranty') },
            { label: 'Asset type', value: toolsListStats.assetTypesDistinct, filterKey: 'assetType', href: toolsSummaryCardHref('assetType') },
            { label: 'In Service', value: toolsListStats.inService, filterKey: 'inService', href: toolsSummaryCardHref('inService') },
            { label: 'Pending for approval', value: toolsListStats.pendingApproval, filterKey: 'pendingApproval', href: toolsSummaryCardHref('pendingApproval') },
            { label: 'Assigned People', value: toolsListStats.assignedPeople, filterKey: 'assignedPeople', href: toolsSummaryCardHref('assignedPeople') },
            { label: 'Asset Category', value: toolsListStats.categoriesDistinct, filterKey: 'assetCategory', href: toolsSummaryCardHref('assetCategory') },
        ],
        [toolsListStats],
    );

    if (!mounted) return null;



    return (

        <>
            <PermissionGuard moduleId="hrm_asset_tools" redirectTo="/dashboard">

            <div className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                <Sidebar />

                <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">

                    <Navbar />

                    <div className="p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-x-hidden" style={{ backgroundColor: '#F2F6F9' }}>

                        <AssetListSummaryPanels
                            leftCards={toolsSummaryLeftCards}
                            rightCards={toolsSummaryRightCards}
                            onCardClick={handleSummaryCardClick}
                            isCardActive={isSummaryCardActive}
                        />

                        {/* Header and Actions in Single Row Matching Employee Page */}

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Asset Management</h1>
                                <Link
                                    href="/HRM/Asset/Vehicle/dashboard"
                                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white border border-gray-200 text-xs sm:text-sm font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-200 shadow-sm transition-colors"
                                >
                                    <Truck className="shrink-0" size={18} />
                                    Vehicle assets
                                </Link>
                            </div>



                            {/* Right Side - Actions Bar */}

                            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full lg:w-auto lg:flex-1 lg:max-w-none">

                                {/* Filter Toggle Icon */}

                                {activeTab === 'asset' && (

                                    <button

                                        onClick={() => setShowFilters(!showFilters)}

                                        className={`p-2 hover:bg-gray-100 rounded-lg transition-colors bg-white shadow-sm border border-gray-800/20 shrink-0 ${showFilters ? 'bg-gray-100' : ''}`}

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
                                        onMouseEnter={warmToolsInboxBadge}
                                        onFocus={warmToolsInboxBadge}

                                        className="relative p-2 hover:bg-amber-50 rounded-lg transition-colors bg-white shadow-sm border border-amber-200/80 text-amber-800 shrink-0"

                                        title="Pending requests — tools & equipment (vehicle service uses Vehicle Assets bell)"

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

                                <div className="relative flex-1 min-w-[120px] sm:min-w-[160px] max-w-xs sm:max-w-sm w-full sm:w-52 group order-last sm:order-none basis-full sm:basis-auto">

                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />

                                    <input

                                        type="text"

                                        placeholder="Search"

                                        value={searchQuery}

                                        onChange={(e) => setSearchQuery(e.target.value)}

                                        className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-1.5 sm:py-2 border border-gray-800/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white"

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

                                    <div className="flex items-center gap-2 shrink-0">

                                        {!selectionMode ? (

                                            <>

                                                {canAssignUnassignedAssets && (

                                                    <button

                                                        onClick={() => setShowAssignChoiceModal(true)}

                                                        className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 text-xs sm:text-sm whitespace-nowrap"

                                                    >

                                                        <UserPlus size={18} />

                                                        <span>Assign</span>

                                                    </button>

                                                )}

                                                <button

                                                    type="button"

                                                    onClick={() => setBulkHolderModal({ open: true, mode: 'return' })}

                                                    className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 text-xs sm:text-sm whitespace-nowrap"

                                                    title="Bulk return by holder"

                                                >

                                                    <Undo2 size={18} />

                                                    <span className="hidden sm:inline">Bulk return</span>

                                                </button>

                                                <button

                                                    type="button"

                                                    onClick={() => setBulkHolderModal({ open: true, mode: 'transfer' })}

                                                    className="bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 text-xs sm:text-sm whitespace-nowrap"

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

                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 text-xs sm:text-sm whitespace-nowrap"

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

                                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 text-xs sm:text-sm whitespace-nowrap ${selectedAssetIds.length > 0

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



                                {((activeTab === 'asset' && canAccessAddToolsAsset()) ||
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

                                            className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm text-xs sm:text-sm whitespace-nowrap shrink-0 ml-auto sm:ml-0"

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

                        <div className="flex flex-wrap border-b border-gray-200 mb-4 sm:mb-6">

                            <button
                                type="button"
                                {...navHrefProps(buildToolsAssetListHref({ tab: 'asset', status: statusFilter === 'All' ? '' : statusFilter }))}

                                onClick={() => {

                                    setActiveTab('asset');

                                    setSearchQuery('');

                                }}

                                className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${activeTab === 'asset'

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
                                type="button"
                                {...navHrefProps(buildToolsAssetListHref({ tab: 'type' }))}

                                onClick={() => {

                                    setActiveTab('type');

                                    setSearchQuery('');

                                }}

                                className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${activeTab === 'type'

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
                                type="button"
                                {...navHrefProps(buildToolsAssetListHref({ tab: 'category' }))}

                                onClick={() => {

                                    setActiveTab('category');

                                    setSearchQuery('');

                                }}

                                className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${activeTab === 'category'

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
                                type="button"
                                {...navHrefProps(buildToolsAssetListHref({ tab: 'accessories' }))}

                                onClick={() => {

                                    setActiveTab('accessories');

                                    setSearchQuery('');

                                    setAccessoryCatalogStatusFilter('pool');

                                }}

                                className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${activeTab === 'accessories'

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
                                type="button"
                                {...navHrefProps(buildToolsAssetListHref({ tab: 'lossDamage', lossDamageStatus: 'All' }))}

                                onClick={() => {

                                    setActiveTab('lossDamage');

                                    setSearchQuery('');
                                    setLossDamageStatusFilter('All');
                                    setLossDamageSubTab('assets');

                                }}

                                className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-all relative ${activeTab === 'lossDamage'

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

                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">

                                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">

                                    <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">Filter by</span>



                                    {/* Status Dropdown */}

                                    <div className="relative">

                                        <select

                                            value={statusFilter}

                                            onChange={(e) => setStatusFilter(e.target.value)}

                                            className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none pr-8 cursor-pointer min-w-0 max-w-full"

                                        >

                                            <option value="MyAsset">My Asset</option>
                                            <option value="Draft">My Draft</option>
                                            <option value="All">All Status</option>
                                            <option value="Assigned">Assigned</option>
                                            <option value="Unassigned">Unassigned</option>
                                            <option value="AwaitingApproval">Awaiting Approval</option>
                                            <option value="OnLeave">Parking / On Leave</option>
                                            <option value="OnService">On Service</option>
                                            <option value="WarrantyYes">Warranty — Yes</option>

                                        </select>

                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">

                                            <polyline points="6 9 12 15 18 9"></polyline>

                                        </svg>

                                    </div>

                                    {statusFilter === 'Assigned' && (
                                        <>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">Assigned To</span>
                                            <SearchableAssignedToFilter
                                                value={normalizedAssignedToFilter}
                                                onChange={setAssignedToEmployeeFilter}
                                                employeeOptions={assignedEmployeeOptions}
                                                companyOptions={assignedCompanyOptions}
                                                employeePrefix={ASSIGNED_FILTER_EMPLOYEE_PREFIX}
                                                companyPrefix={ASSIGNED_FILTER_COMPANY_PREFIX}
                                            />
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleDownloadAssetListClick}
                                        disabled={downloadingAssetList || activeTabDownloadAssets.length === 0}
                                        className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Download size={16} />
                                        {downloadingAssetList ? 'Generating…' : 'Download Asset List'}
                                    </button>

                                    {/* Clear Filters */}

                                    {statusFilter !== 'All' && (

                                        <button

                                            onClick={() => {
                                                setStatusFilter('All');
                                                setAssignedToEmployeeFilter('');
                                            }}

                                            className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 font-medium"

                                        >

                                            Clear Filters

                                        </button>

                                    )}

                                </div>

                            </div>

                        )}

                        {activeTab === 'accessories' && (

                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">

                                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">

                                    <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">Filter by</span>

                                    <div className="relative">

                                        <select

                                            value={accessoryCatalogStatusFilter}

                                            onChange={(e) => setAccessoryCatalogStatusFilter(e.target.value)}

                                            className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none pr-8 cursor-pointer min-w-0 max-w-full sm:min-w-[13rem]"

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

                                            className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 font-medium"

                                        >

                                            Clear Filters

                                        </button>

                                    )}

                                    <button
                                        type="button"
                                        onClick={handleDownloadAssetListClick}
                                        disabled={downloadingAssetList || activeTabDownloadAssets.length === 0}
                                        className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Download size={16} />
                                        {downloadingAssetList ? 'Generating…' : 'Download Asset List'}
                                    </button>

                                </div>

                            </div>

                        )}

                        {(activeTab === 'type' || activeTab === 'category') && (
                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
                                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleDownloadAssetListClick}
                                        disabled={downloadingAssetList || activeTabDownloadAssets.length === 0}
                                        className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Download size={16} />
                                        {downloadingAssetList ? 'Generating…' : 'Download Asset List'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'lossDamage' && (
                            <>
                                <div className="flex gap-2 mb-4 bg-gray-100/80 p-1 rounded-xl w-fit border border-gray-200/50">
                                    <button
                                        type="button"
                                        onClick={() => setLossDamageSubTab('assets')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                            lossDamageSubTab === 'assets'
                                                ? 'bg-white text-blue-600 shadow-sm font-black'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        Assets
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLossDamageSubTab('accessories')}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                            lossDamageSubTab === 'accessories'
                                                ? 'bg-white text-blue-600 shadow-sm font-black'
                                                : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        Accessories
                                    </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
                                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">
                                        <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">Filter by</span>
                                        <div className="relative">
                                            <select
                                                value={lossDamageStatusFilter}
                                                onChange={(e) => setLossDamageStatusFilter(e.target.value)}
                                                className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm bg-white appearance-none pr-8 cursor-pointer min-w-0 max-w-full sm:min-w-[13rem]"
                                                aria-label="Filter loss and damage by status"
                                            >
                                                <option value="All">All</option>
                                                <option value="Lost">Lost</option>
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
                                                className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 font-medium"
                                            >
                                                Clear Filters
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleDownloadAssetListClick}
                                            disabled={downloadingAssetList || activeTabDownloadAssets.length === 0}
                                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <Download size={16} />
                                            {downloadingAssetList ? 'Generating…' : 'Download Asset List'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}



                        {/* Asset Types Table */}

                        <div className="bg-white rounded-lg shadow-sm overflow-hidden w-full max-w-full">

                            <div className="overflow-x-auto w-full max-w-full">

                                <table className="w-full min-w-[720px] sm:min-w-[900px] lg:min-w-0 table-auto text-xs sm:text-sm">

                                    {activeTab === 'asset' ? (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    {selectionMode && (

                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left">

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

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">VALUE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">PURCHASE DATE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">INVOICE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ACCESSORIES</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider"> </th>

                                                </tr>

                                            </thead>

                                            <tbody className="bg-white divide-y divide-gray-200">

                                                {loading ? (

                                                    <tr><td colSpan={selectionMode ? "12" : "11"} className="px-6 py-8 text-center text-gray-500">Loading assets...</td></tr>

                                                ) : sortedFilteredAssetTableRows.length === 0 ? (

                                                    <tr><td colSpan={selectionMode ? "12" : "11"} className="px-6 py-8 text-center text-gray-500">No Assets Found.</td></tr>

                                                ) : (

                                                    assetListPagination.paginatedRows.map((item, index) => {
                                                        const assetHref = resolveAssetDetailHref(item) || '';

                                                        return (
                                                        <ListTableRowLink
                                                            key={item._id}
                                                            href={assetHref}
                                                            router={router}
                                                            enabled={!selectionMode && Boolean(assetHref)}
                                                        >
                                                        <tr
                                                            id={buildAssetFocusElementId({ assetId: item._id })}
                                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedAssetIds.includes(item._id) ? 'bg-blue-50/20' : ''}`}
                                                            onClick={
                                                                selectionMode
                                                                    ? () => {
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
                                                                      }
                                                                    : undefined
                                                            }
                                                        >

                                                            {selectionMode && (

                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">

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

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                <div className="relative z-10 pointer-events-none">{assetListPagination.startIndex + index + 1}</div>
                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 font-medium text-blue-600 hover:underline">
                                                                <div className="relative z-10 pointer-events-none">{item.assetId}</div>
                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                <div className="relative z-10 pointer-events-none">{item.type}</div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                <div className="relative z-10 pointer-events-none">{item.category}</div>
                                                            </td>
                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 font-semibold">
                                                                <div className="relative z-10 pointer-events-none">{item.name || '-'}</div>
                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">

                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(item.assetValue || 0)}

                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">

                                                                {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-GB') : '-'}

                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">

                                                                {item.invoiceFile ? (

                                                                    <button

                                                                        onClick={async (e) => {

                                                                            e.stopPropagation();

                                                                            const result = await openAttachmentInNewTab(item.invoiceFile, {
                                                                                name: `${item.name || 'Asset'} Invoice`,
                                                                                mimeType: 'application/pdf',
                                                                            });

                                                                            if (!result.ok) {
                                                                                toast({
                                                                                    variant: 'destructive',
                                                                                    title: 'Cannot open document',
                                                                                    description: result.error || 'The invoice could not be loaded.',
                                                                                });
                                                                            }

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

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">

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

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">

                                                                <div className="flex flex-col items-start gap-1">

                                                                    {assetListShouldShowWaitingBadge(item) ? (

                                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 whitespace-nowrap" title={`Waiting for: ${getAssetListWaitingLabel(item)}`}>

                                                                            Waiting: {getAssetListWaitingLabel(item)}

                                                                        </span>

                                                                    ) : (

                                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getAssetStatusBadgeClass(item.status, item)}`}>

                                                                            {(() => {
                                                                                const statusStr = String(item.status || '');
                                                                                const isPoolStatus =
                                                                                    statusStr === 'Unassigned' || statusStr === 'Returned';
                                                                                const hasOperationalFlags =
                                                                                    isServiceActive(item) || isLeaveActive(item);
                                                                                if (isPoolStatus && !hasOperationalFlags) return statusStr;

                                                                                const isAssignedRelated =
                                                                                    statusStr === 'Assigned' ||
                                                                                    item?.assignedTo ||
                                                                                    item?.assignedCompany ||
                                                                                    hasOperationalFlags;
                                                                                if (!isAssignedRelated && !isPoolStatus) return statusStr;

                                                                                const assigneeStr = resolveAssetListAssigneeStr(item);
                                                                                return formatAssetAssignmentStatusLine(item, assigneeStr);
                                                                            })()}

                                                                        </span>

                                                                    )}

                                                                </div>

                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right">
                                                                <div className="relative z-20 flex items-center justify-end gap-2">



                                                                    {isAdmin() && (

                                                                        <button

                                                                            onClick={(e) => {

                                                                                e.stopPropagation();

                                                                                setDeleteConfirm({
                                                                                    isOpen: true,
                                                                                    assetId: item._id,
                                                                                    assetName: item.name || item.assetId,
                                                                                    mode: 'asset',
                                                                                    accessory: null,
                                                                                });

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
                                                        </ListTableRowLink>
                                                        );
                                                    })

                                                )}

                                            </tbody>

                                        </>

                                    ) : activeTab === 'category' ? (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSIGN</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">UNASSIGN</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>

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

                                                            {...navHrefProps(
                                                                buildToolsAssetListHref({
                                                                    tab: 'asset',
                                                                    search: cat.name || '',
                                                                }),
                                                            )}

                                                            onClick={(e) => {

                                                                e.stopPropagation();

                                                                setActiveTab('asset');

                                                                setSearchQuery(cat.name);

                                                            }}

                                                            className="hover:bg-gray-50 transition-colors cursor-pointer"

                                                        >

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">{index + 1}</td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm">

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

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 font-mono">{cat.categoryId || '-'}</td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-xs sm:text-sm text-gray-600 font-normal">

                                                                {cat.typeNames.length > 0 ? cat.typeNames.join(', ') : '-'}

                                                            </td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-mono">{cat.assetCount}</td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">{cat.assignedTotal}</td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">{cat.unassignedTotal}</td>

                                                            <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right text-xs sm:text-sm">

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

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Accessories ID</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">PRICE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET ID</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Owned by</th>



                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>

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

                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">{index + 1}</td>
                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 font-mono">{row.accessoryCatalogId || '—'}</td>


                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-xs sm:text-sm font-medium text-gray-900">{row.name}</td>

                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">

                                                                    {Number(row.price || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}

                                                                </td>

                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-xs sm:text-sm text-gray-600 max-w-md">
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

                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm">
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

                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-xs sm:text-sm text-gray-700 max-w-[14rem]">
                                                                    {isCatalogTerminalStatus(row)
                                                                        ? ''
                                                                        : (row.ownedByDisplay || '').trim() || '—'}
                                                                </td>


                                                                <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right text-xs sm:text-sm">

                                                                    {isAdmin() && !isCatalogTerminalStatus(row) && (

                                                                        <button

                                                                            type="button"

                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setCatalogDeleteTarget(row);
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
                                                                    <td colSpan="8" className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4">
                                                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                                                            <p className="text-xs font-semibold text-slate-500 mb-3">
                                                                                <span className="text-slate-700">Details: </span>
                                                                                {row.description || 'No description'}
                                                                            </p>
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                {catalogRowStatus(row) === 'Attached' && row.assetItemId && (
                                                                                    <button
                                                                                        type="button"
                                                                                        {...navHrefProps(
                                                                                            (() => {
                                                                                                const aid = row.assetItemId?._id || row.assetItemId;
                                                                                                return aid
                                                                                                    ? `/HRM/Asset/details/${String(aid)}?tab=accessories`
                                                                                                    : '';
                                                                                            })(),
                                                                                        )}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const aid = row.assetItemId?._id || row.assetItemId;
                                                                                            if (!aid) return;
                                                                                            navigateFromList(router, `/HRM/Asset/details/${String(aid)}?tab=accessories`);
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
                                        lossDamageSubTab === 'assets' ? (
                                            <>
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">VALUE</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">LOST DATE</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">FINE LINK</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ACCESSORIES</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider"> </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {loading ? (
                                                        <tr><td colSpan="11" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                                                    ) : lossDamageListRows.length === 0 ? (
                                                        <tr><td colSpan="11" className="px-6 py-8 text-center text-gray-500">No assets found for the selected Loss &amp; Damage status.</td></tr>
                                                    ) : (
                                                        lossDamageListRows.map((row, index) => {
                                                            const item = row.item;
                                                            const fineIdForRow = item?.lossDamageFineId || item?.pendingActionDetails?.fineId || '';
                                                            const isEol = String(item.status || '').trim().toLowerCase().replace(/\s+/g, '') === 'endoflife';
                                                            const displayId = getLossDamageTableDisplayId(item);
                                                            const displayName = item.name || '—';
                                                            const displayStatus = item.pendingAction === 'Loss and Damage' ? 'Pending' : (item.status || '—');

                                                            return (
                                                                <tr
                                                                    key={`asset-${item._id}`}
                                                                    id={buildAssetFocusElementId({ assetId: item._id })}
                                                                    className="hover:bg-rose-50/40 transition-colors cursor-pointer"
                                                                    {...navHrefProps(resolveAssetDetailHref(item) || '')}
                                                                    onClick={() => openAssetDetailFromList(router, item)}
                                                                >
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">{index + 1}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600 hover:underline">
                                                                        <div className="relative z-10 pointer-events-none">{displayId}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">{item.type}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">{item.category}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-semibold">
                                                                        <div className="relative z-10 pointer-events-none">{displayName}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(item.assetValue || 0)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">{formatLostDate(row)}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                                        {isEol ? (
                                                                            <span className="text-blue-600 font-semibold">View Asset</span>
                                                                        ) : fineIdForRow ? (
                                                                            <Link
                                                                                href={`/HRM/Fine/${encodeURIComponent(String(fineIdForRow))}`}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                                                                            >
                                                                                {getLossDamageFineLinkLabel(item.lossDamageFineStatus)}
                                                                            </Link>
                                                                        ) : (
                                                                            <span className="text-gray-400 pointer-events-none">Pending</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">
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
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">
                                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-100 pointer-events-none">
                                                                            {displayStatus}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right">
                                                                        {isAdmin() && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setDeleteConfirm({
                                                                                        isOpen: true,
                                                                                        assetId: item._id,
                                                                                        assetName: item.name || item.assetId,
                                                                                        mode: 'asset',
                                                                                        accessory: null,
                                                                                    });
                                                                                }}
                                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                                title="Delete asset"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
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
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Accessories ID</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">PRICE</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSET ID</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">FINE LINK</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Owned by</th>
                                                        <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider"> </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {loading ? (
                                                        <tr><td colSpan="9" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                                                    ) : lossDamageListRows.length === 0 ? (
                                                        <tr><td colSpan="9" className="px-6 py-8 text-center text-gray-500">No accessories found for the selected Loss &amp; Damage status.</td></tr>
                                                    ) : (
                                                        lossDamageListRows.map((row, index) => {
                                                            const item = row.item;
                                                            const acc = row.accessory;
                                                            const fineIdForRow =
                                                                acc?.fineId ||
                                                                (item?.lostDetachedAccessories || []).find((x) => x?.accessoryId === acc?.accessoryId)?.fineId ||
                                                                '';
                                                            const isEol = ['end of life', 'endoflife'].includes(String(acc?.status || '').trim().toLowerCase());
                                                            const displayId = acc?.accessoryId || '—';
                                                            const displayName = acc?.name || 'Accessory';
                                                            const displayStatus = acc?.pendingAction === 'Loss and Damage' ? 'Pending' : (acc?.status || '—');

                                                            return (
                                                                <tr
                                                                    key={`accessory-${acc?._id || index}`}
                                                                    id={buildAssetFocusElementId({
                                                                        assetId: item._id,
                                                                        accessoryKey: String(acc?.accessoryId || acc?._id || ''),
                                                                    })}
                                                                    className="hover:bg-rose-50/40 transition-colors cursor-pointer"
                                                                    {...navHrefProps(
                                                                        (() => {
                                                                            const base = resolveAssetDetailHref(item);
                                                                            return base ? `${base}?tab=accessories` : '';
                                                                        })(),
                                                                    )}
                                                                    onClick={() => openAssetDetailFromList(router, item, { tab: 'accessories' })}
                                                                >
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">{index + 1}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600 hover:underline">
                                                                        <div className="relative z-10 pointer-events-none">{displayId}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-xs sm:text-sm text-gray-900 font-semibold">
                                                                        <div className="relative z-10 pointer-events-none flex flex-col">
                                                                            <span>{displayName}</span>
                                                                            <span className="text-[11px] text-slate-500 font-medium">
                                                                                {item.assetId} — {item.name || ''}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        <div className="relative z-10 pointer-events-none">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED' }).format(acc?.amount || 0)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                                                                        <div className="relative z-10 pointer-events-none">{item.assetId}</div>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                                        {isEol ? (
                                                                            <span className="text-blue-600 font-semibold">View Asset</span>
                                                                        ) : fineIdForRow ? (
                                                                            <Link
                                                                                href={`/HRM/Fine/${encodeURIComponent(String(fineIdForRow))}`}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                                                                            >
                                                                                {getLossDamageFineLinkLabel(acc?.fineStatus)}
                                                                            </Link>
                                                                        ) : (
                                                                            <span className="text-gray-400 pointer-events-none">Pending</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">
                                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-100 pointer-events-none">
                                                                            {displayStatus}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                                                                        {resolveAssetListAssigneeStr(item) || '—'}
                                                                    </td>
                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right">
                                                                        {isAdmin() && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setDeleteConfirm({
                                                                                        isOpen: true,
                                                                                        assetId: item._id,
                                                                                        assetName: acc.name || acc.accessoryId || 'Accessory',
                                                                                        mode: 'accessory',
                                                                                        accessory: acc,
                                                                                    });
                                                                                }}
                                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                                title="Delete accessory from asset"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </>
                                        )

                                    ) : (

                                        <>

                                            <thead className="bg-gray-50 border-b border-gray-200">

                                                <tr>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">SL NO</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">TYPE</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSETS</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">ASSIGNED</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">UNASSIGNED</th>

                                                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-right text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>

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

                                                                    {...navHrefProps(
                                                                        buildToolsAssetListHref({
                                                                            tab: 'category',
                                                                            search: type.type || '',
                                                                        }),
                                                                    )}

                                                                    onClick={(e) => {

                                                                        e.stopPropagation();

                                                                        setActiveTab('category');

                                                                        setSearchQuery(type.type);

                                                                    }}

                                                                    className="hover:bg-gray-50 transition-colors cursor-pointer"

                                                                >

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700">{index + 1}</td>

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">

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

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 font-mono">{type.assetId}</td>

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-mono">{type.categoryCount || 0}</td>

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-mono">{stats.count}</td>

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-medium">{stats.assigned}</td>

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-medium">{stats.unassigned}</td>

                                                                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right">

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



                            {/* Pagination Footer */}

                            {activeTab === 'asset' && assetListPagination.totalItems > 0 && (
                                <div className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2 sm:gap-3 lg:gap-4">
                                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-600">Show</span>
                                            <select
                                                value={assetListPerPage}
                                                onChange={(e) => {
                                                    setAssetListPerPage(Number(e.target.value));
                                                    setAssetListPage(1);
                                                }}
                                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                aria-label="Assets per page"
                                            >
                                                {ASSET_LIST_PER_PAGE_OPTIONS.map((size) => (
                                                    <option key={size} value={size}>{size}</option>
                                                ))}
                                            </select>
                                            <span className="text-sm text-gray-600">per page</span>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Showing {assetListPagination.startIndex + 1} to{' '}
                                            {Math.min(assetListPagination.endIndex, assetListPagination.totalItems)} of{' '}
                                            {assetListPagination.totalItems} assets
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAssetListPage((prev) => Math.max(1, prev - 1))}
                                            disabled={assetListPagination.currentPage === 1}
                                            className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${assetListPagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                                            aria-label="Previous page"
                                        >
                                            &lt;
                                        </button>

                                        {Array.from({ length: Math.min(5, assetListPagination.totalPages) }, (_, i) => {
                                            let pageNum;
                                            const { totalPages, currentPage } = assetListPagination;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    type="button"
                                                    onClick={() => setAssetListPage(pageNum)}
                                                    className={`px-3 py-1 rounded-lg text-sm border ${currentPage === pageNum
                                                        ? 'bg-blue-500 text-white border-blue-500'
                                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}

                                        <button
                                            type="button"
                                            onClick={() => setAssetListPage((prev) => Math.min(assetListPagination.totalPages, prev + 1))}
                                            disabled={assetListPagination.currentPage === assetListPagination.totalPages}
                                            className={`px-3 py-1 rounded-lg text-sm bg-gray-200 text-blue-600 ${assetListPagination.currentPage === assetListPagination.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                                            aria-label="Next page"
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab !== 'asset' && ((activeTab === 'accessories'
                                ? accessoryCatalog.length
                                : activeTab === 'lossDamage'
                                    ? lossDamageListRows.length
                                    : assetTypes.length) > 0) && (

                                    <div className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 border-t border-gray-200">

                                        <p className="text-sm text-gray-500">

                                            Showing{' '}
                                            {activeTab === 'accessories'
                                                ? accessoryCatalogFiltered.length
                                                : activeTab === 'lossDamage'
                                                    ? lossDamageListRows.length
                                                    : filteredAssetTableRows.length}
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

                    assetActionUser={accessoriesAssetActionUser}

                />



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

                    inboxScope="tools"

                    onClose={() => {

                        setPendingInboxModalOpen(false);

                        fetchPendingInboxCount();

                    }}

                    onRefreshParent={() => {

                        fetchAssetTypes();

                        fetchPendingInboxCount({ force: true });

                    }}

                />

                <OwnerOnDutyReviewModal
                    isOpen={!!ownerOnDutyReviewId}
                    dashboardActionId={ownerOnDutyReviewId}
                    onClose={() => {
                        setOwnerOnDutyReviewId(null);
                        const params = new URLSearchParams(searchParamsRef.current.toString());
                        params.delete('ownerOnDutyReview');
                        router.replace(`/HRM/Asset${params.toString() ? `?${params.toString()}` : ''}`);
                    }}
                    onCompleted={() => {
                        fetchAssetTypes();
                        fetchPendingInboxCount({ force: true });
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



                <AssetListExportDialog
                    open={assetListExportModalOpen}
                    onOpenChange={setAssetListExportModalOpen}
                    downloading={downloadingAssetList}
                    showGroupByOwner={assetListExportHasMultipleOwners}
                    onDownload={(opts) => void handleDownloadAssetList(opts)}
                />

                <AlertDialog

                    open={deleteConfirm.isOpen}

                    onOpenChange={(open) => !open && setDeleteConfirm({ ...deleteConfirm, isOpen: false })}

                >

                    <AlertDialogContent className="bg-white rounded-[24px]">

                        <AlertDialogHeader>

                            <AlertDialogTitle className="text-xl font-bold">
                                {deleteConfirm.mode === 'accessory' ? 'Delete Accessory' : 'Delete Asset'}
                            </AlertDialogTitle>

                            <AlertDialogDescription className="text-sm text-gray-500">
                                {deleteConfirm.mode === 'accessory' ? (
                                    <>
                                        Remove accessory{' '}
                                        <span className="font-bold text-gray-900">"{deleteConfirm.assetName}"</span>{' '}
                                        from this asset? This action is permanent and cannot be undone.
                                    </>
                                ) : (
                                    <>
                                        Are you sure you want to delete{' '}
                                        <span className="font-bold text-gray-900">"{deleteConfirm.assetName}"</span>? This action is permanent and cannot be undone.
                                    </>
                                )}
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
            <ConfirmAlertDialog
                open={Boolean(catalogDeleteTarget)}
                onOpenChange={(open) => !open && !catalogDeleteLoading && setCatalogDeleteTarget(null)}
                title="Remove from catalog?"
                description={
                    catalogDeleteTarget
                        ? `Remove "${catalogDeleteTarget.name}" from the accessory catalog?`
                        : ''
                }
                confirmLabel="Remove"
                destructive
                loading={catalogDeleteLoading}
                onConfirm={async () => {
                    if (!catalogDeleteTarget?._id) return;
                    setCatalogDeleteLoading(true);
                    try {
                        await axiosInstance.delete(`/AssetAccessoryCatalog/${catalogDeleteTarget._id}`);
                        toast({ title: 'Removed', description: 'Accessory removed from catalog' });
                        fetchAccessoryCatalog();
                        setCatalogDeleteTarget(null);
                    } catch (err) {
                        toast({
                            variant: 'destructive',
                            title: 'Error',
                            description: err.response?.data?.message || 'Delete failed',
                        });
                    } finally {
                        setCatalogDeleteLoading(false);
                    }
                }}
            />
        </>
    );
}

export default function AssetPage() {
    return (
        <Suspense fallback={null}>
            <AssetPageContent />
        </Suspense>
    );
}
