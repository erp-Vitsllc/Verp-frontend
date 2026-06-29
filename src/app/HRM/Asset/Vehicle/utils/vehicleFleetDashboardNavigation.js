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
