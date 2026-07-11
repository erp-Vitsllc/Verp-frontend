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

/** Parents with children: View only. */
const E_ONLY_VIEW = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];
/** Action rows (Add Asset): all columns enabled. */
const E_ALL = [];

const ASSET_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_asset: E_ONLY_VIEW,
    hrm_asset_tools: E_ONLY_VIEW,
    hrm_asset_tools_add: E_ALL,
};

/**
 * Asset root + Tools Asset branch (not Vehicle — handled by vehicleGroupPermissionUiRules).
 * Parents with children → View only; leaf action rows → all columns.
 */
export function getAssetBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_asset')) return null;
    if (String(module.id).startsWith('hrm_asset_vehicle')) return null;
    if (Object.prototype.hasOwnProperty.call(ASSET_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return ASSET_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    if (module.children?.length) return E_ONLY_VIEW;
    return null;
}

export function applyAssetPermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) => {
        const id = String(m.id || '');
        return id.startsWith('hrm_asset') && !id.startsWith('hrm_asset_vehicle');
    });
    flat.forEach((m) => {
        const disabledList = getAssetBranchDisabledPermTypes(m);
        if (disabledList == null) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
}
