/**
 * Display labels for reward workflow statuses.
 * Cash/Gift: management approval → Completed (payment tracked separately as Pending → Billed).
 */
export function formatRewardStatusLabel(status, reward) {
    const s = String(status || '').trim();
    if (!s) return '—';

    // After management (or final approve): show Completed; payment column tracks Pending/Billed
    if (
        s === 'Pending Accounts' ||
        s === 'Approved (Not Paid)' ||
        s === 'Approved (Paid)' ||
        s === 'Paid' ||
        s === 'Completed' ||
        s === 'Approved' ||
        s === 'Active'
    ) {
        return 'Completed';
    }

    return s;
}

export function isRewardApprovedNotPaid(reward) {
    const status = reward?.rewardStatus || reward?.approvalStatus;
    return status === 'Approved (Not Paid)' || status === 'Pending Accounts';
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

/**
 * Payment Status for list / detail:
 * — after management approve → Pending
 * — after Accounts Zoho Expense → Billed
 * — certificate / no amount → —
 */
export function formatRewardPaymentStatusLabel(reward) {
    if (!reward) return '—';

    const type = String(reward?.rewardType || '').toLowerCase();
    const isCashOrGift =
        type.includes('cash') || type.includes('gift') || type.includes('bonus');
    const amount = Number(reward?.amount) || 0;
    if (!isCashOrGift && amount <= 0) return '—';

    const stored = String(reward?.paymentStatus || '').trim();
    if (stored === 'Billed' || stored === 'Paid') return 'Billed';
    if (isRewardZohoExpenseSynced(reward)) return 'Billed';

    const status = String(reward?.rewardStatus || reward?.approvalStatus || '').trim();
    const awaitingOrPastManagement = [
        'Pending Accounts',
        'Approved (Not Paid)',
        'Approved',
        'Approved (Paid)',
        'Paid',
        'Completed',
    ].includes(status);

    if (stored === 'Pending' || stored === 'Not Paid') return 'Pending';
    if (awaitingOrPastManagement) return 'Pending';

    return '—';
}

/** @deprecated use formatRewardPaymentStatusLabel — kept for older call sites */
export function formatRewardPaymentLabel(reward) {
    const label = formatRewardPaymentStatusLabel(reward);
    if (label === 'Billed') return 'Paid';
    if (label === 'Pending') return 'Not Paid';
    return label;
}

/** Employee profile: only Approved / Paid — hide Draft, Pending, etc. */
export const EMPLOYEE_PROFILE_REWARD_STATUSES = [
    'Approved',
    'Approved (Paid)',
    'Approved (Not Paid)',
    'Paid',
    'Completed',
    'Active',
    'Pending Accounts',
];

export function isRewardVisibleOnEmployeeProfile(reward) {
    const status = String(reward?.rewardStatus || reward?.approvalStatus || '').trim();
    return EMPLOYEE_PROFILE_REWARD_STATUSES.includes(status);
}

/** Separate Payments Pay step is disabled for rewards — Zoho success marks Billed. */
export function isRewardPaymentEligible() {
    return false;
}
