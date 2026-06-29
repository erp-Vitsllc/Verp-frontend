import {
    VEHICLE_MAIN_TAB_MODULES,
    VEHICLE_BASIC_CARD_MODULES,
    VEHICLE_DOCUMENT_INNER_TAB_MODULES,
} from '@/constants/hrmModulePermissions';
import {
    canViewAnyOf,
    crudAccessUnion,
    hasAnyPermission,
    hasModuleFlag,
    hasPermission,
    isAdmin,
} from '@/utils/permissions';

export function vehicleTabVisible(tabId) {
    if (isAdmin()) return true;
    const modules = VEHICLE_MAIN_TAB_MODULES[tabId];
    if (!Array.isArray(modules) || modules.length === 0) return false;
    if (canViewAnyOf(modules)) return true;
    return hasAnyPermission('hrm_asset_vehicle');
}

export function vehicleCardCrud(cardKey) {
    if (isAdmin()) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }
    const modules = VEHICLE_BASIC_CARD_MODULES[cardKey] || [];
    if (modules.length === 0) {
        return crudAccessUnion(['hrm_asset_vehicle_view_basic', 'hrm_asset_vehicle']);
    }
    const union = crudAccessUnion(modules);
    if (union.view) return union;
    return crudAccessUnion(['hrm_asset_vehicle']);
}

export function vehicleDocumentInnerTabVisible(innerTab) {
    if (isAdmin()) return true;
    const modules = VEHICLE_DOCUMENT_INNER_TAB_MODULES[innerTab] || [];
    if (canViewAnyOf(modules)) return true;
    return hasAnyPermission('hrm_asset_vehicle_view_document') || hasAnyPermission('hrm_asset_vehicle');
}

export function canAccessVehicleListPage() {
    return (
        isAdmin() ||
        hasPermission('hrm_asset_vehicle_list', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessAddVehicle() {
    return (
        isAdmin() ||
        hasModuleFlag('hrm_asset_vehicle_add', 'isView') ||
        hasPermission('hrm_asset_vehicle_add', 'isCreate')
    );
}

export function canAccessVehicleDetailsPage() {
    return (
        isAdmin() ||
        hasPermission('hrm_asset_vehicle_view', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessVehicleDashboard() {
    return (
        isAdmin() ||
        hasPermission('hrm_asset_vehicle_dashboard', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessVehicleServiceRequests() {
    return (
        isAdmin() ||
        hasPermission('hrm_asset_vehicle_service_requests', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function vehiclePermitCardCrud() {
    return crudAccessUnion([
        'hrm_asset_vehicle_view_permit_card',
        'hrm_asset_vehicle_view_permit',
        'hrm_asset_vehicle_view',
    ]);
}

export function vehicleTabCrud(tabId) {
    const modules = VEHICLE_MAIN_TAB_MODULES[tabId] || [];
    return crudAccessUnion(modules.length ? modules : ['hrm_asset_vehicle']);
}
