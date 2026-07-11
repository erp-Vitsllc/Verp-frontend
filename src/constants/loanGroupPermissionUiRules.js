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
/** Create Loan / Create Advance: all columns enabled. */
const E_ALL = [];

const LOAN_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_loan: E_ONLY_VIEW,
    hrm_loan_loan: E_ONLY_VIEW,
    hrm_loan_loan_create: E_ALL,
    hrm_loan_advance: E_ONLY_VIEW,
    hrm_loan_advance_create: E_ALL,
};

export function getLoanBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_loan')) return null;
    if (Object.prototype.hasOwnProperty.call(LOAN_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return LOAN_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    if (module.children?.length) return E_ONLY_VIEW;
    return null;
}

export function applyLoanPermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) =>
        String(m.id).startsWith('hrm_loan'),
    );
    flat.forEach((m) => {
        const disabledList = getLoanBranchDisabledPermTypes(m);
        if (disabledList == null) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
}
