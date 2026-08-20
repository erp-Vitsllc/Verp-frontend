import { HRM_MODULE } from '@/constants/hrmModulePermissions';

function flattenModulesTree(modules) {
    let flat = [];
    modules.forEach((m) => {
        flat.push(m);
        if (m.children) {
            flat = flat.concat(flattenModulesTree(m.children));
        }
    });
    return flat;
}

const emptyPerm = () => ({
    isView: false,
    isCreate: false,
    isEdit: false,
    isDelete: false,
    isDownload: false,
});

const E_ONLY_VIEW = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];
/** Full CRUD + download — all columns enabled on the permission chart. */
const E_ALL = [];

const VEHICLE_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_asset_vehicle: E_ONLY_VIEW,
    hrm_asset_vehicle_list: E_ONLY_VIEW,
    hrm_asset_vehicle_sold_fleet: E_ONLY_VIEW,
    hrm_asset_vehicle_add: E_ALL,
    hrm_asset_vehicle_create_service: E_ALL,
    hrm_asset_vehicle_add_fuel: E_ALL,
};

export function getVehicleBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_asset_vehicle')) return null;
    if (Object.prototype.hasOwnProperty.call(VEHICLE_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return VEHICLE_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    if (module.children?.length) return E_ONLY_VIEW;
    return E_ONLY_VIEW;
}

export function applyVehiclePermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) =>
        String(m.id).startsWith('hrm_asset_vehicle'),
    );
    flat.forEach((m) => {
        const disabledList = getVehicleBranchDisabledPermTypes(m);
        if (disabledList == null) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
}
