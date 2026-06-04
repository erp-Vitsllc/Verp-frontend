import { EMPLOYEE_MAIN_TAB_MODULES } from '@/constants/hrmModulePermissions';
import { hasPermission, isAdmin } from '@/utils/permissions';

/** Inactive profiles: delete when user has employee delete on any onboarding section. Active: admin only. */
export function canDeleteEmployeeFromList(employee) {
    if (!employee) return false;
    if (isAdmin()) return true;

    const isActive = (employee.profileStatus || 'inactive').toLowerCase() === 'active';
    if (isActive) return false;

    if (hasPermission('hrm_employees_view', 'isDelete')) return true;

    const moduleIds = Object.values(EMPLOYEE_MAIN_TAB_MODULES).flat();
    return moduleIds.some((moduleId) => hasPermission(moduleId, 'isDelete'));
}
