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
