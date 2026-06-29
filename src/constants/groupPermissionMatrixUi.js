import { getEmployeeBranchDisabledPermTypes, applyEmployeePermissionUiClamp } from '@/constants/employeeGroupPermissionUiRules';
import { getCompanyBranchDisabledPermTypes, applyCompanyPermissionUiClamp } from '@/constants/companyGroupPermissionUiRules';
import { getVehicleBranchDisabledPermTypes, applyVehiclePermissionUiClamp } from '@/constants/vehicleGroupPermissionUiRules';

const PERM_KEYS = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];

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

/** True when this permission column cannot be toggled for the module row. */
export function isGroupPermissionCheckboxDisabled(module, permId, modulePermissions = {}) {
    if (permId === 'isView') return false;

    const isViewEnabled = !!modulePermissions.isView;

    if (permId === 'isDownload') {
        if (!module?.hasDownload || !isViewEnabled) return true;
    } else if (!isViewEnabled) {
        return true;
    }

    const branchDisabled =
        getEmployeeBranchDisabledPermTypes(module) ||
        getCompanyBranchDisabledPermTypes(module) ||
        getVehicleBranchDisabledPermTypes(module);
    return !!branchDisabled?.includes(permId);
}

/** Disabled checkboxes always render unchecked; enabled ones reflect stored state. */
export function getEffectiveGroupPermissionChecked(module, permId, modulePermissions = {}) {
    if (isGroupPermissionCheckboxDisabled(module, permId, modulePermissions)) {
        return false;
    }
    return !!modulePermissions[permId];
}

/**
 * Force stored permissions to match UI rules: branch-disabled columns and
 * view/download gates are cleared (unchecked) in state, not only in the UI.
 */
export function applyDisabledGroupPermissionClamp(permissions, modulesRoot) {
    applyEmployeePermissionUiClamp(permissions);
    applyCompanyPermissionUiClamp(permissions);
    applyVehiclePermissionUiClamp(permissions);

    if (!Array.isArray(modulesRoot) || modulesRoot.length === 0) return;

    flattenModulesTree(modulesRoot).forEach((m) => {
        if (!permissions[m.id]) {
            permissions[m.id] = {
                isView: false,
                isCreate: false,
                isEdit: false,
                isDelete: false,
                isDownload: false,
            };
        }
        PERM_KEYS.forEach((key) => {
            if (isGroupPermissionCheckboxDisabled(m, key, permissions[m.id])) {
                permissions[m.id][key] = false;
            }
        });
    });
}
