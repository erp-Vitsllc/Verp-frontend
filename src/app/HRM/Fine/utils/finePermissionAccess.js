import { isAdmin, hasModuleFlag, hasPermission, hasAnyPermission } from '@/utils/permissions';

/** Add / edit fine actions (permission chart: Add Fine = ALL). */
export function canAccessAddFine() {
    return (
        isAdmin() ||
        hasModuleFlag('hrm_fine_add', 'isView') ||
        hasPermission('hrm_fine_add', 'isCreate') ||
        hasPermission('hrm_fine_add', 'isEdit') ||
        hasPermission('hrm_fine_add', 'isDelete') ||
        hasPermission('hrm_fine_add', 'isDownload') ||
        // Legacy groups that only had flat hrm_fine create/edit.
        hasPermission('hrm_fine', 'isCreate') ||
        hasPermission('hrm_fine', 'isEdit')
    );
}

export function canAccessFineList() {
    return isAdmin() || hasPermission('hrm_fine', 'isView') || hasAnyPermission('hrm_fine');
}
