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
import { isFlowchartAssetModuleOverride } from '@/utils/assetFlowchartModuleAccess';

/** Flowchart AC / Admin Officer: open Vehicle (and Tools) when group perms unchecked. */
function canOpenVehicleModule() {
    return isAdmin() || isFlowchartAssetModuleOverride();
}

/** Add Vehicle row carries Create/Edit/Delete/Download for vehicle asset cards. */
function withAddVehicleWriteAccess(moduleIds) {
    const ids = Array.isArray(moduleIds) ? [...moduleIds] : [];
    if (!ids.includes('hrm_asset_vehicle_add')) {
        ids.push('hrm_asset_vehicle_add');
    }
    return crudAccessUnion(ids);
}

export function vehicleTabVisible(tabId) {
    if (isAdmin()) return true;
    const modules = VEHICLE_MAIN_TAB_MODULES[tabId];
    if (!Array.isArray(modules) || modules.length === 0) return false;
    if (canViewAnyOf(modules)) return true;
    return hasAnyPermission('hrm_asset_vehicle') || canOpenVehicleModule();
}

export function vehicleCardCrud(cardKey) {
    if (isAdmin()) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }
    const modules = VEHICLE_BASIC_CARD_MODULES[cardKey] || ['hrm_asset_vehicle'];
    return withAddVehicleWriteAccess(modules);
}

export function vehicleDocumentInnerTabVisible(innerTab) {
    if (isAdmin()) return true;
    const modules = VEHICLE_DOCUMENT_INNER_TAB_MODULES[innerTab] || [];
    if (canViewAnyOf(modules)) return true;
    return hasAnyPermission('hrm_asset_vehicle') || canOpenVehicleModule();
}

export function canAccessVehicleListPage() {
    return (
        canOpenVehicleModule() ||
        hasPermission('hrm_asset_vehicle_list', 'isView') ||
        hasPermission('hrm_asset_vehicle_sold_fleet', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessActiveFleet() {
    return (
        canOpenVehicleModule() ||
        hasPermission('hrm_asset_vehicle_list', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessSoldFleet() {
    return (
        canOpenVehicleModule() ||
        hasPermission('hrm_asset_vehicle_sold_fleet', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessAddVehicle() {
    return (
        isAdmin() ||
        hasModuleFlag('hrm_asset_vehicle_add', 'isView') ||
        hasPermission('hrm_asset_vehicle_add', 'isCreate') ||
        hasPermission('hrm_asset_vehicle_add', 'isEdit') ||
        hasPermission('hrm_asset_vehicle_add', 'isDelete') ||
        hasPermission('hrm_asset_vehicle_add', 'isDownload')
    );
}

/** Edit existing vehicle assets (list + profile cards) — uses Add Vehicle Edit. */
export function canEditVehicleAsset() {
    return (
        isAdmin() ||
        hasPermission('hrm_asset_vehicle_add', 'isEdit') ||
        hasPermission('hrm_asset_vehicle', 'isEdit')
    );
}

export function canAccessCreateService() {
    return (
        isAdmin() ||
        hasModuleFlag('hrm_asset_vehicle_create_service', 'isView') ||
        hasPermission('hrm_asset_vehicle_create_service', 'isCreate') ||
        hasPermission('hrm_asset_vehicle_create_service', 'isEdit') ||
        hasPermission('hrm_asset_vehicle_create_service', 'isDelete') ||
        hasPermission('hrm_asset_vehicle_create_service', 'isDownload')
    );
}

export function canAccessAddToolsAsset() {
    return (
        canOpenVehicleModule() ||
        hasModuleFlag('hrm_asset_tools_add', 'isView') ||
        hasPermission('hrm_asset_tools_add', 'isCreate') ||
        hasPermission('hrm_asset_tools_add', 'isEdit') ||
        hasPermission('hrm_asset_tools_add', 'isDelete') ||
        hasPermission('hrm_asset_tools_add', 'isDownload') ||
        hasAnyPermission('hrm_asset_tools')
    );
}

export function canAccessVehicleDetailsPage() {
    return (
        canOpenVehicleModule() ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessVehicleDashboard() {
    return (
        canOpenVehicleModule() ||
        hasPermission('hrm_asset_vehicle', 'isView') ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function canAccessVehicleServiceRequests() {
    return (
        canOpenVehicleModule() ||
        hasAnyPermission('hrm_asset_vehicle')
    );
}

export function vehiclePermitCardCrud() {
    return withAddVehicleWriteAccess(['hrm_asset_vehicle']);
}

export function vehicleTabCrud(tabId) {
    const modules = VEHICLE_MAIN_TAB_MODULES[tabId] || ['hrm_asset_vehicle'];
    return withAddVehicleWriteAccess(modules);
}
