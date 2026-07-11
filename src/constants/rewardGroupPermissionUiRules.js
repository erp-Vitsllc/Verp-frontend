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

/** Parent with children: View only. */
const E_ONLY_VIEW = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];
/** Create Reward: all columns enabled. */
const E_ALL = [];

const REWARD_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_reward: E_ONLY_VIEW,
    hrm_reward_create: E_ALL,
};

export function getRewardBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_reward')) return null;
    if (Object.prototype.hasOwnProperty.call(REWARD_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return REWARD_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    if (module.children?.length) return E_ONLY_VIEW;
    return null;
}

export function applyRewardPermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) =>
        String(m.id).startsWith('hrm_reward'),
    );
    flat.forEach((m) => {
        const disabledList = getRewardBranchDisabledPermTypes(m);
        if (disabledList == null) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
}
