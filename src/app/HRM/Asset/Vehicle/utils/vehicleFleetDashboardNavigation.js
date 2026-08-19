/** Dashboard KPI tile → list route (status query or inbox). */
export const VEHICLE_DASHBOARD_KPI_ROUTES = {
    serviceDue: { href: '/HRM/Asset/Vehicle?status=ServiceDue', title: 'Vehicles with overdue service' },
    serviceDueSoon: { href: '/HRM/Asset/Vehicle?status=ServiceDueSoon', title: 'Vehicles with service due within 30 days' },
    registrationDue: { href: '/HRM/Asset/Vehicle?status=RegistrationDue', title: 'Vehicles with overdue registration' },
    registrationDueSoon: {
        href: '/HRM/Asset/Vehicle?status=RegistrationDueSoon',
        title: 'Vehicles with registration due within 30 days',
    },
    assigned: { href: '/HRM/Asset/Vehicle?status=Assigned', title: 'Assigned vehicles' },
    unassigned: { href: '/HRM/Asset/Vehicle?status=Unassigned', title: 'Unassigned vehicles' },
    inService: { href: '/HRM/Asset/Vehicle?status=OnService', title: 'Vehicles in service' },
    requestPending: {
        href: '/HRM/Asset/Vehicle?status=AssetRequestPending',
        title: 'Vehicles with pending service or asset requests',
    },
    requestApproved: {
        href: '/HRM/Asset/Vehicle?status=AssetRequestApproved',
        title: 'Vehicles with approved asset requests',
    },
    handoverPending: { href: '/HRM/Asset/Vehicle?status=HandoverPending', title: 'Assignments awaiting acceptance' },
    handoverAccepted: { href: '/HRM/Asset/Vehicle?status=HandoverAccepted', title: 'Accepted handover assignments' },
};

export function vehicleDashboardKpiHref(key) {
    return VEHICLE_DASHBOARD_KPI_ROUTES[key]?.href || '/HRM/Asset/Vehicle';
}

export function vehicleDashboardKpiTitle(key) {
    return VEHICLE_DASHBOARD_KPI_ROUTES[key]?.title || 'View vehicle list';
}

/** Dashboard Vehicle Fines bar → list page with Access Vehicle Fine open for that vehicle. */
export function vehicleDashboardFineListHref({
    vehicleId = '',
    plate = '',
    fineIds = [],
    from = '',
    to = '',
} = {}) {
    const params = new URLSearchParams();
    params.set('access', 'fine');
    if (vehicleId) params.set('vehicleId', String(vehicleId));
    if (plate) params.set('plate', String(plate));
    const ids = (Array.isArray(fineIds) ? fineIds : String(fineIds || '').split(','))
        .map((id) => String(id || '').trim())
        .filter(Boolean);
    if (ids.length) params.set('fineIds', ids.join(','));
    if (from) params.set('from', String(from));
    if (to) params.set('to', String(to));
    return `/HRM/Asset/Vehicle?${params.toString()}`;
}

export const VEHICLE_ACCESS_FINE_QUERY_KEYS = ['access', 'vehicleId', 'fineIds', 'from', 'to', 'plate'];

export function applyVehicleAccessFineQuery(params, focus = {}) {
    const next = params instanceof URLSearchParams ? params : new URLSearchParams(params || '');
    if (focus.access) next.set('access', String(focus.access));
    if (focus.vehicleId) next.set('vehicleId', String(focus.vehicleId));
    if (focus.fineIds) next.set('fineIds', String(focus.fineIds));
    if (focus.from) next.set('from', String(focus.from));
    if (focus.to) next.set('to', String(focus.to));
    if (focus.plate) next.set('plate', String(focus.plate));
    return next;
}

export function stripVehicleAccessFineQuery(href) {
    const raw = String(href || '').trim() || '/HRM/Asset/Vehicle';
    try {
        const url = new URL(raw, 'http://local');
        VEHICLE_ACCESS_FINE_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
        const qs = url.searchParams.toString();
        return qs ? `${url.pathname}?${qs}` : url.pathname;
    } catch {
        return '/HRM/Asset/Vehicle';
    }
}

/** Dashboard model-year slice → list filtered to that year. */
export function vehicleDashboardModelYearListHref(year) {
    const value = String(year || '').trim() || 'Unknown';
    const params = new URLSearchParams();
    params.set('modelYear', value);
    return `/HRM/Asset/Vehicle?${params.toString()}`;
}

export function vehicleModelYearKey(vehicle) {
    const year = String(vehicle?.modelYear ?? '').trim();
    return year || 'Unknown';
}

export function vehicleMatchesModelYearFilter(vehicle, yearFilter) {
    const target = String(yearFilter || '').trim();
    if (!target) return true;
    return vehicleModelYearKey(vehicle) === target;
}
