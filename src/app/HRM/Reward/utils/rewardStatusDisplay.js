/**
 * Display labels for reward workflow statuses.
 * Cash/Gift use Approved = Approved (Not Paid) until Accounts pays → Approved (Paid).
 */
export function formatRewardStatusLabel(status, rewardType) {
    const s = String(status || '').trim();
    if (!s) return '—';

    const type = String(rewardType || '').toLowerCase();
    const isCashOrGift = type.includes('cash') || type.includes('gift') || type.includes('bonus');

    if (s === 'Approved' && isCashOrGift) return 'Approved (Not Paid)';
    if (s === 'Approved (Paid)' || s === 'Paid') return 'Approved (Paid)';
    return s;
}

export function isRewardApprovedNotPaid(reward) {
    const status = reward?.rewardStatus || reward?.approvalStatus;
    return status === 'Approved';
}

export function isRewardFullyPaid(reward) {
    const status = reward?.rewardStatus || reward?.approvalStatus;
    return status === 'Approved (Paid)' || status === 'Paid' || status === 'Completed';
}

/** Paid / Not Paid for profile tables and reward detail summary. */
export function formatRewardPaymentLabel(reward) {
    if (!reward) return '—';
    if (isRewardFullyPaid(reward)) return 'Paid';

    const status = reward?.rewardStatus || reward?.approvalStatus;
    const type = String(reward?.rewardType || '').toLowerCase();
    const isCashOrGift = type.includes('cash') || type.includes('gift') || type.includes('bonus');
    const amount = Number(reward?.amount) || 0;
    const paid = Number(reward?.paidAmount) || 0;

    if (amount > 0 && paid >= amount - 0.01) return 'Paid';
    if (status === 'Approved' && (isCashOrGift || amount > 0)) return 'Not Paid';
    if (amount > 0 && isCashOrGift) return 'Not Paid';
    return '—';
}

/** Employee profile: only Approved / Paid / Not Paid — hide Draft, Pending, etc. */
export const EMPLOYEE_PROFILE_REWARD_STATUSES = [
    'Approved',
    'Approved (Paid)',
    'Approved (Not Paid)',
    'Paid',
    'Completed',
    'Active',
];

export function isRewardVisibleOnEmployeeProfile(reward) {
    const status = String(reward?.rewardStatus || reward?.approvalStatus || '').trim();
    return EMPLOYEE_PROFILE_REWARD_STATUSES.includes(status);
}

export function isRewardPaymentEligible(reward) {
    if (!isRewardApprovedNotPaid(reward)) return false;
    const amount = Number(reward?.amount) || 0;
    const paid = Number(reward?.paidAmount) || 0;
    return amount > 0 && amount - paid > 0.01;
}
