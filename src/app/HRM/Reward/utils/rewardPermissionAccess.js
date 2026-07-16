import { isAdmin, hasModuleFlag, hasPermission, hasAnyPermission } from '@/utils/permissions';

/** Create / edit reward actions (permission chart: Create Reward = ALL). */
export function canAccessCreateReward() {
    return (
        isAdmin() ||
        hasModuleFlag('hrm_reward_create', 'isView') ||
        hasPermission('hrm_reward_create', 'isCreate') ||
        hasPermission('hrm_reward_create', 'isEdit') ||
        hasPermission('hrm_reward_create', 'isDelete') ||
        hasPermission('hrm_reward_create', 'isDownload') ||
        // Legacy groups that only had flat hrm_reward create/edit.
        hasPermission('hrm_reward', 'isCreate') ||
        hasPermission('hrm_reward', 'isEdit')
    );
}

export function canAccessRewardList() {
    return isAdmin() || hasPermission('hrm_reward', 'isView') || hasAnyPermission('hrm_reward');
}

function collectIdentityIds(userOrEmp) {
    if (!userOrEmp) return [];
    if (typeof userOrEmp !== 'object') return [String(userOrEmp)];
    return [
        userOrEmp._id,
        userOrEmp.id,
        userOrEmp.employeeObjectId,
        userOrEmp.employeeId,
    ]
        .filter(Boolean)
        .map(String);
}

function identityMatches(user, target) {
    const userIds = collectIdentityIds(user);
    if (!userIds.length || target == null) return false;
    const targetIds = collectIdentityIds(target);
    return userIds.some((id) => targetIds.includes(id));
}

function isHrDepartmentUser(user) {
    if (!user) return false;
    const dept = (user.department || '').toLowerCase();
    const des = (user.designation || '').toLowerCase();
    return (
        dept === 'hr' ||
        dept.includes('human resource') ||
        des.includes('human resource') ||
        /\bhr\b/.test(des)
    );
}

function isManagementUser(user) {
    if (!user) return false;
    const dept = (user.department || '').toLowerCase();
    return dept === 'management' || dept.includes('management');
}

/** Employee's HOD / primary reportee. */
function isEmployeeHod(user, employee) {
    if (!user || !employee) return false;
    const reportee = employee.primaryReportee;
    if (!reportee) return false;

    if (identityMatches(user, reportee)) return true;

    const userEmail = (user.companyEmail || user.email || '').trim().toLowerCase();
    if (userEmail && typeof reportee === 'object') {
        const reporteeEmail = (reportee.companyEmail || reportee.email || '').trim().toLowerCase();
        if (reporteeEmail && reporteeEmail === userEmail) return true;
    }

    return false;
}

/**
 * Edit Certificate — no status filter.
 * Visible to: certificate creator, HR, admin, employee's HOD, management.
 */
export function canEditRewardCertificate(user, reward, employee) {
    if (!user || !reward) return false;
    if (isAdmin()) return true;
    if (isHrDepartmentUser(user)) return true;
    if (isManagementUser(user)) return true;
    if (isEmployeeHod(user, employee)) return true;

    const creator = reward.createdBy;
    if (creator && identityMatches(user, creator)) return true;

    return false;
}
