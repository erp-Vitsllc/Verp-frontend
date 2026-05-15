import { crudAccess, getUserPermissions, isAdmin } from '@/utils/permissions';

export const EMPLOYEE_SALARY_CARD_MODULES = {
    salary: 'hrm_employees_view_salary',
    bank: 'hrm_employees_view_bank',
    certificate: 'hrm_employees_view_salary_certificate',
};

function rowAllowsEdit(row) {
    if (!row) return false;
    return row.isEdit === true || row.edit === true || row.full === true;
}

function rowAllowsCreate(row) {
    if (!row) return false;
    return row.isCreate === true || row.create === true || row.full === true;
}

/**
 * Card-level CRUD for Salary / Bank / Certificate (group permission rows under View Employee → Salary).
 */
export function employeeProfileCardCrudAccess(moduleId) {
    if (isAdmin()) {
        return { view: true, create: true, edit: true, delete: true, download: true };
    }

    const base = crudAccess(moduleId);
    if (!base.view) return base;

    const row = getUserPermissions()[moduleId];
    if (!row) return base;

    return {
        view: true,
        create: base.create || rowAllowsCreate(row),
        edit: base.edit || rowAllowsEdit(row),
        delete: base.delete || row.isDelete === true || row.delete === true || row.full === true,
        download: base.download || row.isDownload === true || row.download === true,
    };
}
