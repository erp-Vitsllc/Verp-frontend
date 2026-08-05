/**
 * Display labels for reward workflow statuses.
 * Cash/Gift: Paid only after Zoho Expense succeeds on Accounts approve.
 */
export function formatRewardStatusLabel(status, reward) {
    const s = String(status || '').trim();
    if (!s) return '—';

    const type = String(
        (typeof reward === 'string' ? reward : reward?.rewardType) || '',
    ).toLowerCase();
    const isCashOrGift =
        type.includes('cash') || type.includes('gift') || type.includes('bonus');
    const hasZoho =
        typeof reward === 'object' &&
        reward &&
        Boolean(
            String(reward.zohoExpenseId || '').trim() ||
                String(reward.zohoJournalId || '').trim(),
        );

    // Never show Paid for cash/gift until Zoho Expense exists
    if ((s === 'Approved (Paid)' || s === 'Paid') && isCashOrGift && !hasZoho) {
        return 'Pending Accounts';
    }
    if (s === 'Approved (Paid)' || s === 'Paid') return 'Approved (Paid)';
    if (s === 'Approved (Not Paid)') return 'Pending Accounts';
    return s;
}

export function isRewardApprovedNotPaid(reward) {
    const status = reward?.rewardStatus || reward?.approvalStatus;
    return status === 'Approved (Not Paid)';
}

export function isRewardFullyPaid(reward) {
    const status = reward?.rewardStatus || reward?.approvalStatus;
    const type = String(reward?.rewardType || '').toLowerCase();
    const isCashOrGift =
        type.includes('cash') || type.includes('gift') || type.includes('bonus') || Number(reward?.amount) > 0;
    if (isCashOrGift && !isRewardZohoExpenseSynced(reward)) return false;
    return status === 'Approved (Paid)' || status === 'Paid' || status === 'Completed';
}

/** Whether Zoho Expense was posted successfully for this cash/gift reward. */
export function isRewardZohoExpenseSynced(reward) {
    return Boolean(
        String(reward?.zohoExpenseId || '').trim() || String(reward?.zohoJournalId || '').trim(),
    );
}

/** Paid / Not Paid for profile tables and reward detail summary. */
export function formatRewardPaymentLabel(reward) {
    if (!reward) return '—';

    const type = String(reward?.rewardType || '').toLowerCase();
    const isCashOrGift =
        type.includes('cash') || type.includes('gift') || type.includes('bonus');
    const amount = Number(reward?.amount) || 0;

    if (isCashOrGift || amount > 0) {
        return isRewardZohoExpenseSynced(reward) ? 'Paid' : 'Not Paid';
    }

    if (isRewardFullyPaid(reward)) return 'Paid';
    return '—';
}

/** Employee profile: only Approved / Paid — hide Draft, Pending, etc. */
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

/** Separate Payments Pay step is disabled for rewards — Zoho success marks Paid. */
export function isRewardPaymentEligible() {
    return false;
}
