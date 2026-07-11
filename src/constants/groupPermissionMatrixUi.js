import { getEmployeeBranchDisabledPermTypes, applyEmployeePermissionUiClamp } from '@/constants/employeeGroupPermissionUiRules';
import { getCompanyBranchDisabledPermTypes, applyCompanyPermissionUiClamp } from '@/constants/companyGroupPermissionUiRules';
import { getVehicleBranchDisabledPermTypes, applyVehiclePermissionUiClamp } from '@/constants/vehicleGroupPermissionUiRules';
import { getAssetBranchDisabledPermTypes, applyAssetPermissionUiClamp } from '@/constants/assetGroupPermissionUiRules';
import { getRewardBranchDisabledPermTypes, applyRewardPermissionUiClamp } from '@/constants/rewardGroupPermissionUiRules';
import { getLoanBranchDisabledPermTypes, applyLoanPermissionUiClamp } from '@/constants/loanGroupPermissionUiRules';
import { getFineBranchDisabledPermTypes, applyFinePermissionUiClamp } from '@/constants/fineGroupPermissionUiRules';

const ACTION_PERM_KEYS = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];

const emptyPerm = () => ({
    isView: false,
    isCreate: false,
    isEdit: false,
    isDelete: false,
    isDownload: false,
});

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

function buildParentIdByModuleId(modulesRoot = []) {
    const map = new Map();
    flattenModulesTree(modulesRoot).forEach((m) => {
        if (m?.id) map.set(m.id, m.parent ?? null);
    });
    return map;
}

function hasViewFlag(perm) {
    return perm?.isView === true || perm?.isActive === true;
}

/**
 * Every ancestor in the permission tree must have View checked.
 * If a parent is unchecked, children cannot be checked.
 */
export function areAllAncestorsViewEnabled(module, allPermissions = {}, modulesRoot = []) {
    if (!module?.parent) return true;
    const parentIdByModuleId =
        modulesRoot.length > 0
            ? buildParentIdByModuleId(modulesRoot)
            : null;

    let parentId = module.parent;
    while (parentId) {
        if (!hasViewFlag(allPermissions?.[parentId])) return false;
        parentId = parentIdByModuleId
            ? parentIdByModuleId.get(parentId) ?? null
            : null;
        // Without a tree map we can only verify the immediate parent.
        if (!parentIdByModuleId) break;
    }
    return true;
}

/**
 * True when this permission column cannot be toggled for the module row.
 * @param {object} [options]
 * @param {Record<string, object>} [options.allPermissions] - full group permissions map
 * @param {object[]} [options.modulesRoot] - MODULES tree (for ancestor chain)
 */
export function isGroupPermissionCheckboxDisabled(
    module,
    permId,
    modulePermissions = {},
    options = {},
) {
    const allPermissions = options.allPermissions || null;
    const modulesRoot = options.modulesRoot || [];

    if (
        allPermissions &&
        module?.parent &&
        !areAllAncestorsViewEnabled(module, allPermissions, modulesRoot)
    ) {
        return true;
    }

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
        getVehicleBranchDisabledPermTypes(module) ||
        getAssetBranchDisabledPermTypes(module) ||
        getRewardBranchDisabledPermTypes(module) ||
        getLoanBranchDisabledPermTypes(module) ||
        getFineBranchDisabledPermTypes(module);
    return !!branchDisabled?.includes(permId);
}

/** Disabled checkboxes always render unchecked; enabled ones reflect stored state. */
export function getEffectiveGroupPermissionChecked(
    module,
    permId,
    modulePermissions = {},
    options = {},
) {
    if (isGroupPermissionCheckboxDisabled(module, permId, modulePermissions, options)) {
        return false;
    }
    return !!modulePermissions[permId];
}

/**
 * Force stored permissions to match UI rules: parent View gates children,
 * branch-disabled columns, and view/download gates.
 */
export function applyDisabledGroupPermissionClamp(permissions, modulesRoot) {
    applyEmployeePermissionUiClamp(permissions);
    applyCompanyPermissionUiClamp(permissions);
    applyVehiclePermissionUiClamp(permissions);
    applyAssetPermissionUiClamp(permissions);
    applyRewardPermissionUiClamp(permissions);
    applyLoanPermissionUiClamp(permissions);
    applyFinePermissionUiClamp(permissions);

    if (!Array.isArray(modulesRoot) || modulesRoot.length === 0) return;

    flattenModulesTree(modulesRoot).forEach((m) => {
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }

        if (m.parent && !areAllAncestorsViewEnabled(m, permissions, modulesRoot)) {
            permissions[m.id] = emptyPerm();
            return;
        }

        ACTION_PERM_KEYS.forEach((key) => {
            if (isGroupPermissionCheckboxDisabled(m, key, permissions[m.id], {
                allPermissions: permissions,
                modulesRoot,
            })) {
                permissions[m.id][key] = false;
            }
        });
    });
}
