import { hasPermission, isAdmin } from '@/utils/permissions';
import { isEmployeeProfileStatusActive } from '@/utils/employeeActivationSections';

/** Employee list row delete — `hrm_employees_list` delete only (not card-level delete). Active: admin only. */
export function canDeleteEmployeeFromList(employee) {
    if (!employee) return false;
    if (isAdmin()) return true;

    if (isEmployeeProfileStatusActive(employee)) return false;

    return hasPermission('hrm_employees_list', 'isDelete');
}
