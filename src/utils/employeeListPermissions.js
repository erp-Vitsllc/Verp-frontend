import { hasPermission, isAdmin } from '@/utils/permissions';
import { isEmployeeProfileLiveActive } from '@/utils/employeeActivationSections';

/** Employee list row delete — `hrm_employees_list` delete only (not card-level delete). Active: admin only. */
export function canDeleteEmployeeFromList(employee) {
    if (!employee) return false;
    if (isAdmin()) return true;

    if (isEmployeeProfileLiveActive(employee)) return false;

    return hasPermission('hrm_employees_list', 'isDelete');
}
