import { VEHICLE_SERVICE_TYPES } from '@/app/HRM/Asset/Vehicle/components/vehicleServiceUtils';

export const VEHICLE_ACCESS_SERVICE_TYPES = VEHICLE_SERVICE_TYPES;

export function vehicleAccessServiceSlug(type) {
    return String(type || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
}

export function vehicleAccessServiceTypeFromSlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    return VEHICLE_ACCESS_SERVICE_TYPES.find((type) => vehicleAccessServiceSlug(type) === key) || '';
}

export function vehicleAccessServiceListPath(type) {
    const slug = vehicleAccessServiceSlug(type);
    return slug ? `/HRM/Asset/Vehicle/access-service/${encodeURIComponent(slug)}` : '/HRM/Asset/Vehicle/access-service';
}

export const VEHICLE_ACCESS_SERVICE_PENDING = 'Pending Services';
export const VEHICLE_ACCESS_SERVICE_COMPLETED = 'Completed Services';

/** Access Handover filter boxes, in display order. */
export const VEHICLE_ACCESS_HANDOVER_STATUSES = [
    {
        key: 'pending-hr',
        label: 'Pending HR',
        hint: 'Waiting on HR approval',
        pending: true,
    },
    {
        key: 'pending-inspection',
        label: 'Pending Inspection',
        hint: 'Inspection handover still in draft',
        pending: true,
    },
    {
        key: 'completed-inspection',
        label: 'Completed Inspection',
        hint: 'Inspection approved by HR',
        pending: false,
    },
    {
        key: 'pending-assignee',
        label: 'Pending Assignee',
        hint: 'Waiting for the assignment target to accept',
        pending: true,
    },
    {
        key: 'completed-handover',
        label: 'Completed Handover',
        hint: 'Approved assignment handovers',
        pending: false,
    },
    {
        key: 'unassigned-vehicle',
        label: 'Unassigned Vehicle',
        hint: 'Vehicles currently in the unassigned pool',
        pending: true,
    },
];

export function vehicleAccessHandoverStatusFromSlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    return VEHICLE_ACCESS_HANDOVER_STATUSES.find((row) => row.key === key) || null;
}

export function vehicleAccessHandoverListPath(statusKey) {
    const key = String(statusKey || '').trim().toLowerCase();
    return key
        ? `/HRM/Asset/Vehicle/access-handover/${encodeURIComponent(key)}`
        : '/HRM/Asset/Vehicle/access-handover';
}

export const VEHICLE_ACCESS_FINE_TYPES = [
    {
        key: 'all',
        label: 'All Fines & Damage',
        hint: 'Approved, Zoho-entered, and completed records',
        pending: false,
    },
    {
        key: 'vehicle-fine',
        label: 'Vehicle Fine',
        hint: 'Traffic and vehicle fines',
        pending: false,
    },
    {
        key: 'vehicle-damage',
        label: 'Vehicle Damage',
        hint: 'Vehicle damage claims',
        pending: false,
    },
    {
        key: 'loss-damage',
        label: 'Loss & Damage',
        hint: 'Loss and damage on fleet assets',
        pending: false,
    },
];

export function resolveVehicleAccessFineTypeKey(fine) {
    const type = String(fine?.fineType || fine?.category || '').trim();
    const lower = type.toLowerCase();
    if (lower === 'vehicle fine') return 'vehicle-fine';
    if (lower === 'vehicle damage') return 'vehicle-damage';
    if (lower.includes('loss') && lower.includes('damage')) return 'loss-damage';
    if (lower === 'loss & damage') return 'loss-damage';
    return 'other';
}

export function matchesVehicleAccessFineType(fine, typeKey) {
    const key = String(typeKey || 'all').trim().toLowerCase();
    if (key === 'all') return true;
    return resolveVehicleAccessFineTypeKey(fine) === key;
}

const VEHICLE_ACCESS_FINE_STATUSES = ['Approved', 'Active', 'Paid', 'Completed'];

function isZohoEnteredFine(fine) {
    if (String(fine?.zohoBillId || '').trim()) return true;
    if (String(fine?.zohoBillNumber || '').trim()) return true;
    if (String(fine?.zohoSyncStatus || '').toLowerCase() === 'synced') return true;
    if (String(fine?.vendorBillStatus || '').toLowerCase() === 'paid') return true;
    return false;
}

/**
 * Access Vehicle Fine lists post-workflow records only:
 * Approved / Active / Paid / Completed, or already entered in Zoho.
 */
export function isVehicleAccessFineVisible(fine) {
    if (!fine) return false;
    const status = String(fine.fineStatus || '').trim();
    const lower = status.toLowerCase();
    if (lower.includes('pending') || lower === 'draft' || lower.includes('rejected') || lower.includes('cancelled')) {
        return false;
    }
    if (VEHICLE_ACCESS_FINE_STATUSES.includes(status)) return true;
    return isZohoEnteredFine(fine);
}

function mongoId(value) {
    if (!value) return '';
    if (typeof value === 'object') return String(value._id || value.id || '').trim();
    return String(value).trim();
}

function isMongoObjectId(value) {
    return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

export function resolveVehicleAccessFineHref(fine) {
    if (fine?._id) return `/HRM/Fine/${fine._id}`;
    if (fine?.fineId) return `/HRM/Fine/${encodeURIComponent(fine.fineId)}`;
    return '';
}

export function resolveVehicleAccessVehicleHref(fine) {
    const candidates = [fine?.assetObjectId, fine?.vehicleObjectId, fine?.vehicleId];
    for (const raw of candidates) {
        const id = mongoId(raw);
        if (isMongoObjectId(id)) return `/HRM/Asset/Vehicle/details/${id}`;
    }
    return '';
}

export function resolveVehicleAccessOffender(fine) {
    const entry = fine?.assignedEmployees?.[0];
    const employeeId = String(entry?.employeeId || fine?.employeeId || '').trim();
    const employeeName = String(entry?.employeeName || fine?.employeeName || '').trim();
    const isCompany =
        employeeId === 'VEGA-HR-0000' ||
        employeeId === 'VEGA_INTERNAL' ||
        employeeName === 'Vega Digital IT Solutions';
    return {
        employeeId: isCompany ? '' : employeeId,
        employeeName: employeeName || '—',
        isCompany,
    };
}

export function vehicleAccessFineTypeFromKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    return VEHICLE_ACCESS_FINE_TYPES.find((row) => row.key === normalized) || null;
}

/** @deprecated Use VEHICLE_ACCESS_FINE_TYPES — kept for older imports. */
export const VEHICLE_ACCESS_FINE_FILTERS = VEHICLE_ACCESS_FINE_TYPES;

/** @deprecated Use matchesVehicleAccessFineType */
export function matchesVehicleAccessFineFilter(fine, filterKey) {
    return matchesVehicleAccessFineType(fine, filterKey);
}

/** @deprecated Use vehicleAccessFineTypeFromKey */
export function vehicleAccessFineFilterFromKey(key) {
    return vehicleAccessFineTypeFromKey(key);
}
