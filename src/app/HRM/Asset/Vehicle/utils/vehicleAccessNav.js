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

export const VEHICLE_ACCESS_MENU_PARAM = 'accessMenu';
export const VEHICLE_ACCESS_PANEL_PARAM = 'access';
export const VEHICLE_ACCESS_PANEL_KEYS = ['service', 'handover', 'fine', 'fuel'];

/** Old standalone routes — they now redirect onto the vehicle list. */
export const VEHICLE_ACCESS_LEGACY_PATHS = {
    service: '/HRM/Asset/Vehicle/access-service',
    handover: '/HRM/Asset/Vehicle/access-handover',
    fine: '/HRM/Asset/Vehicle/access-fine',
    fuel: '/HRM/Asset/Vehicle/access-fuel',
};

export const VEHICLE_ACCESS_PATHS = {
    service: '/HRM/Asset/Vehicle?access=service',
    handover: '/HRM/Asset/Vehicle?access=handover',
    fine: '/HRM/Asset/Vehicle?access=fine',
    fuel: '/HRM/Asset/Vehicle?access=fuel',
};

/** Vehicle list URL that opens an access panel in place (not a separate page). */
export function vehicleAccessPath(panel, listHref = '/HRM/Asset/Vehicle') {
    const key = String(panel || '').trim().toLowerCase();
    if (!VEHICLE_ACCESS_PANEL_KEYS.includes(key)) return '';
    try {
        const url = new URL(String(listHref || '/HRM/Asset/Vehicle'), 'http://local');
        if (!url.pathname || url.pathname === '/') {
            url.pathname = '/HRM/Asset/Vehicle';
        }
        url.searchParams.delete(VEHICLE_ACCESS_MENU_PARAM);
        url.searchParams.set(VEHICLE_ACCESS_PANEL_PARAM, key);
        if (key !== 'fine') {
            url.searchParams.delete('vehicleId');
            url.searchParams.delete('fineIds');
            url.searchParams.delete('from');
            url.searchParams.delete('to');
            url.searchParams.delete('plate');
        }
        const qs = url.searchParams.toString();
        return qs ? `${url.pathname}?${qs}` : `${url.pathname}?${VEHICLE_ACCESS_PANEL_PARAM}=${key}`;
    } catch {
        return `/HRM/Asset/Vehicle?${VEHICLE_ACCESS_PANEL_PARAM}=${key}`;
    }
}

/** Vehicle list URL that reopens the Vehicle Details menu. */
export function vehicleAccessMenuHref(listHref = '/HRM/Asset/Vehicle') {
    try {
        const url = new URL(String(listHref || '/HRM/Asset/Vehicle'), 'http://local');
        if (!url.pathname || url.pathname === '/') {
            url.pathname = '/HRM/Asset/Vehicle';
        }
        url.searchParams.delete('access');
        url.searchParams.delete('serviceType');
        url.searchParams.delete('handover');
        url.searchParams.delete('vehicleId');
        url.searchParams.delete('fineIds');
        url.searchParams.delete('from');
        url.searchParams.delete('to');
        url.searchParams.delete('plate');
        url.searchParams.set(VEHICLE_ACCESS_MENU_PARAM, '1');
        const qs = url.searchParams.toString();
        return qs ? `${url.pathname}?${qs}` : `${url.pathname}?${VEHICLE_ACCESS_MENU_PARAM}=1`;
    } catch {
        return `/HRM/Asset/Vehicle?${VEHICLE_ACCESS_MENU_PARAM}=1`;
    }
}

export function isVehicleAccessMenuHref(hrefOrSearch) {
    const raw = String(hrefOrSearch || '').trim();
    if (!raw) return false;
    try {
        const url = raw.startsWith('/') || raw.startsWith('http')
            ? new URL(raw, 'http://local')
            : new URL(`http://local/?${raw.replace(/^\?/, '')}`);
        return url.searchParams.get(VEHICLE_ACCESS_MENU_PARAM) === '1';
    } catch {
        return false;
    }
}

export function vehicleAccessServiceListPath(type) {
    const slug = vehicleAccessServiceSlug(type);
    const href = vehicleAccessPath('service');
    if (!slug) return href;
    try {
        const url = new URL(href, 'http://local');
        url.searchParams.set('serviceType', slug);
        return `${url.pathname}?${url.searchParams.toString()}`;
    } catch {
        return `${href}&serviceType=${encodeURIComponent(slug)}`;
    }
}

export const VEHICLE_ACCESS_SERVICE_PENDING = 'Pending Services';
export const VEHICLE_ACCESS_SERVICE_COMPLETED = 'Completed Services';
export const VEHICLE_ACCESS_SERVICE_NOT_YET = 'Not Yet';

export const VEHICLE_ACCESS_SERVICE_STATUS_FILTERS = [
    { key: 'All', label: 'All' },
    { key: VEHICLE_ACCESS_SERVICE_PENDING, label: 'Pending' },
    { key: VEHICLE_ACCESS_SERVICE_COMPLETED, label: 'Completed' },
    { key: VEHICLE_ACCESS_SERVICE_NOT_YET, label: 'Not Yet' },
];

/** Access Handover filter boxes, in display order. */
export const VEHICLE_ACCESS_HANDOVER_STATUSES = [
    {
        key: 'pending-inspection',
        label: 'Pending Inspection',
        hint: 'Created vehicles with no completed inspection yet',
        pending: true,
    },
    {
        key: 'all-handover',
        label: 'All Handover',
        hint: 'Latest handover or inspection per vehicle',
        pending: false,
    },
    {
        key: 'pending-handover',
        label: 'Pending Handover',
        hint: 'Handover waiting on the next person',
        pending: true,
    },
    {
        key: 'assigned-vehicle',
        label: 'Assigned Vehicle',
        hint: 'Vehicles currently assigned',
        pending: false,
    },
    {
        key: 'unassigned-vehicle',
        label: 'Unassigned Vehicle',
        hint: 'Vehicles currently in the unassigned pool',
        pending: false,
    },
    {
        key: 'list-vehicle',
        label: 'List Vehicle',
        hint: 'All vehicles in one list',
        pending: false,
    },
];

const VEHICLE_ACCESS_HANDOVER_STATUS_ALIASES = {
    all: 'all-handover',
    'pending-hr': 'pending-handover',
    'pending-assignee': 'pending-handover',
    'completed-inspection': 'all-handover',
    'completed-handover': 'all-handover',
};

export function vehicleAccessHandoverStatusFromSlug(slug) {
    const raw = String(slug || '').trim().toLowerCase();
    const key = VEHICLE_ACCESS_HANDOVER_STATUS_ALIASES[raw] || raw;
    return VEHICLE_ACCESS_HANDOVER_STATUSES.find((row) => row.key === key) || null;
}

export function vehicleAccessHandoverListPath(statusKey) {
    const key = String(statusKey || '').trim().toLowerCase();
    const href = vehicleAccessPath('handover');
    if (!key) return href;
    try {
        const url = new URL(href, 'http://local');
        url.searchParams.set('handover', key);
        return `${url.pathname}?${url.searchParams.toString()}`;
    } catch {
        return `${href}&handover=${encodeURIComponent(key)}`;
    }
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

export function isVehicleAccessFineTypeIncluded(fine) {
    return resolveVehicleAccessFineTypeKey(fine) !== 'loss-damage';
}

export function matchesVehicleAccessFineType(fine, typeKey) {
    const key = String(typeKey || 'all').trim().toLowerCase();
    if (!isVehicleAccessFineTypeIncluded(fine)) return false;
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
