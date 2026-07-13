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

export function isRewardPaymentEligible(reward) {
    if (!isRewardApprovedNotPaid(reward)) return false;
    const amount = Number(reward?.amount) || 0;
    const paid = Number(reward?.paidAmount) || 0;
    return amount > 0 && amount - paid > 0.01;
}
