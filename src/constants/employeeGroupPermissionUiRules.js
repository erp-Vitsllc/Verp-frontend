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
const E_VIEW_EDIT = ['isCreate', 'isDelete', 'isDownload'];
const E_DOC_CARD = ['isDelete'];

const EMPLOYEE_GROUP_DISABLED_PERMS_BY_ID = {
    hrm_employees: E_ONLY_VIEW,
    hrm_employees_add: E_ONLY_VIEW,
    hrm_employees_list: E_VIEW_EDIT,
    hrm_employees_view: E_ONLY_VIEW,
    hrm_employees_view_basic_details: E_ONLY_VIEW,
    hrm_employees_view_work_details: E_ONLY_VIEW,
    hrm_employees_view_salary_section: E_ONLY_VIEW,
    hrm_employees_view_personal_details: E_ONLY_VIEW,
    hrm_employees_view_documents: E_ONLY_VIEW,
    hrm_employees_view_basic: E_ONLY_VIEW,
    hrm_employees_view_work_employee: E_VIEW_EDIT,
    hrm_employees_view_passport: E_DOC_CARD,
    hrm_employees_view_visa: E_DOC_CARD,
    hrm_employees_view_emirates_id: E_DOC_CARD,
    hrm_employees_view_labour_card: E_DOC_CARD,
    hrm_employees_view_driving_license: E_DOC_CARD,
    hrm_employees_view_medical_insurance: E_DOC_CARD,
    hrm_employees_view_salary: E_DOC_CARD,
    hrm_employees_view_salary_certificate: E_DOC_CARD,
    hrm_employees_view_bank: [],
    hrm_employees_view_work: [],
    hrm_employees_view_personal: E_ONLY_VIEW,
    hrm_employees_view_permanent_address: E_ONLY_VIEW,
    hrm_employees_view_current_address: E_ONLY_VIEW,
    hrm_employees_view_emergency: E_ONLY_VIEW,
    hrm_employees_view_education: E_DOC_CARD,
    hrm_employees_view_experience: E_DOC_CARD,
    hrm_employees_view_documents_live: E_ONLY_VIEW,
    hrm_employees_view_documents_live_with_expiry: E_DOC_CARD,
    hrm_employees_view_documents_live_without_expiry: E_DOC_CARD,
    hrm_employees_view_documents_old: E_DOC_CARD,
};

export function getEmployeeBranchDisabledPermTypes(module) {
    if (!module?.id || !String(module.id).startsWith('hrm_employees')) return null;
    if (Object.prototype.hasOwnProperty.call(EMPLOYEE_GROUP_DISABLED_PERMS_BY_ID, module.id)) {
        return EMPLOYEE_GROUP_DISABLED_PERMS_BY_ID[module.id];
    }
    if (module.children?.length) return E_ONLY_VIEW;
    return E_ONLY_VIEW;
}

/** Legacy key kept in sync with `hrm_employees_view_salary` for older groups / APIs. */
function mirrorSalaryHistoryFromSalary(permissions) {
    const sal = permissions['hrm_employees_view_salary'];
    if (!permissions['hrm_employees_view_salary_history']) {
        permissions['hrm_employees_view_salary_history'] = emptyPerm();
    }
    if (!sal) {
        permissions['hrm_employees_view_salary_history'] = emptyPerm();
        return;
    }
    permissions['hrm_employees_view_salary_history'] = {
        isView: !!sal.isView,
        isCreate: !!sal.isCreate,
        isEdit: !!sal.isEdit,
        isDelete: !!sal.isDelete,
        isDownload: !!sal.isDownload,
    };
}

/** Promote legacy group keys (edit/create/view) to isEdit/isCreate/isView for salary cards. */
export function normalizeStoredEmployeeCardPermissions(permissions) {
    if (!permissions || typeof permissions !== 'object') return;

    const cardModuleIds = [
        'hrm_employees_view_salary',
        'hrm_employees_view_bank',
        'hrm_employees_view_salary_certificate',
    ];

    cardModuleIds.forEach((id) => {
        const row = permissions[id];
        if (!row) return;
        if (row.edit === true || row.full === true) row.isEdit = true;
        if (row.create === true || row.full === true) row.isCreate = true;
        if (row.delete === true || row.full === true) row.isDelete = true;
        if (row.view === true || row.full === true || row.isActive === true) {
            row.isView = true;
            row.isActive = true;
        }
        if (row.download === true) row.isDownload = true;
    });

    mirrorSalaryHistoryFromSalary(permissions);
}

export function applyEmployeePermissionUiClamp(permissions) {
    const flat = flattenModulesTree([HRM_MODULE]).filter((m) => m.id.startsWith('hrm_employees'));
    flat.forEach((m) => {
        const disabledList = getEmployeeBranchDisabledPermTypes(m);
        if (disabledList == null) return;
        if (!permissions[m.id]) {
            permissions[m.id] = emptyPerm();
        }
        disabledList.forEach((key) => {
            permissions[m.id][key] = false;
        });
    });
    mirrorSalaryHistoryFromSalary(permissions);
    normalizeStoredEmployeeCardPermissions(permissions);
}
