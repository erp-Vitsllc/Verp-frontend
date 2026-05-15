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

/** View only — matrix shows View column only for this row. */
const E_ONLY_VIEW = ['isCreate', 'isEdit', 'isDelete', 'isDownload'];

/** Add Company: View + Create only (no Edit / Delete / Download on this row). */
const E_VIEW_CREATE = ['isEdit', 'isDelete', 'isDownload'];

const COMPANY_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_company: E_ONLY_VIEW,
    hrm_company_list: E_ONLY_VIEW,
    hrm_company_add: E_VIEW_CREATE,
    hrm_company_view: E_ONLY_VIEW,
    hrm_company_view_owner: E_ONLY_VIEW,
    hrm_company_view_assets: E_ONLY_VIEW,
    hrm_company_view_fine: E_ONLY_VIEW,
    hrm_company_view_documents: E_ONLY_VIEW,
    hrm_company_view_documents_live: E_ONLY_VIEW,
};

export function getCompanyBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_company')) return null;
    if (Object.prototype.hasOwnProperty.call(COMPANY_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return COMPANY_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    return null;
}

export function applyCompanyPermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) => String(m.id).startsWith('hrm_company'));
    flat.forEach((m) => {
        const disabledList = COMPANY_GROUP_DISABLED_PERMS_BY_ID[m.id];
        if (!disabledList) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
}
