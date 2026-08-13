/**
 * Display labels for reward workflow statuses.
 * Cash/Gift: management approval → Completed (payment tracked separately as Pending → Billed).
 */

function normRewardStatus(rewardOrStatus) {
    if (rewardOrStatus && typeof rewardOrStatus === 'object') {
        return String(rewardOrStatus.rewardStatus || rewardOrStatus.approvalStatus || '')
            .trim()
            .toLowerCase();
    }
    return String(rewardOrStatus || '')
        .trim()
        .toLowerCase();
}

/** Cash Reward / Gift Reward / Certificate → cash | gift | certificate | other */
export function rewardTypeBucket(reward) {
    const t = String(reward?.rewardType || '')
        .trim()
        .toLowerCase();
    if (t.includes('cash')) return 'cash';
    if (t.includes('gift')) return 'gift';
    if (t.includes('certificate')) return 'certificate';
    return 'other';
}

export function isRewardDraftStatus(status) {
    return normRewardStatus(status) === 'draft';
}

/** Any in-progress approval stage (not Draft / Approved / Rejected). */
export function isRewardPendingStatus(status) {
    const s = normRewardStatus(status);
    if (!s || s === 'draft') return false;
    if (s === 'rejected' || s === 'cancelled') return false;
    if (
        s === 'approved' ||
        s === 'approved (paid)' ||
        s === 'approved (not paid)' ||
        s === 'active' ||
        s === 'completed' ||
        s === 'paid'
    ) {
        return false;
    }
    return (
        s === 'pending' ||
        s === 'pending hr' ||
        s === 'pending accounts' ||
        s === 'pending authorization' ||
        s.includes('pending')
    );
}

export function isRewardApprovedStatus(status) {
    const s = normRewardStatus(status);
    return (
        s === 'approved' ||
        s === 'approved (paid)' ||
        s === 'approved (not paid)' ||
        s === 'active' ||
        s === 'completed' ||
        s === 'paid'
    );
}

export function isRewardRejectedStatus(status) {
    const s = normRewardStatus(status);
    return s === 'rejected';
}

/** Total Rewards card: every reward except Draft. */
export function isRewardCountedInTotal(status) {
    return !isRewardDraftStatus(status);
}

function collectViewerIds(viewer) {
    if (!viewer) return [];
    if (typeof viewer !== 'object') return [String(viewer)];
    return [viewer._id, viewer.id, viewer.userId, viewer.employeeObjectId, viewer.employeeId]
        .filter(Boolean)
        .map(String);
}

/** Draft belongs to the logged-in user (creator), so it stays visible in the default list. */
export function isOwnRewardDraft(reward, viewer) {
    if (!isRewardDraftStatus(reward)) return false;
    const viewerIds = collectViewerIds(viewer);
    if (!viewerIds.length) return false;

    const creator = reward?.createdBy;
    const creatorIds =
        creator && typeof creator === 'object'
            ? [creator._id, creator.id, creator.employeeId].filter(Boolean).map(String)
            : creator
              ? [String(creator)]
              : [];

    if (creatorIds.some((id) => viewerIds.includes(id))) return true;

    // Fallback: draft for the employee themselves (self-service edge cases)
    const empId = String(reward?.employeeId || '').trim();
    if (empId && viewerIds.includes(empId)) return true;

    return false;
}

/**
 * Default list (All / Total):
 * - Others: all non-draft statuses
 * - Current user: also their own Drafts
 */
export function isRewardVisibleInDefaultList(reward, viewer) {
    if (isRewardCountedInTotal(reward)) return true;
    return isOwnRewardDraft(reward, viewer);
}

/**
 * List / stats filter for header cards — must match card labels exactly.
 * @returns {boolean}
 */
export function rewardMatchesStatusFilter(reward, selectedStatus, viewer = null) {
    const selected = String(selectedStatus || 'All').trim();
    if (!selected || selected === 'All' || selected === 'Total') {
        return isRewardVisibleInDefaultList(reward, viewer);
    }

    const status = normRewardStatus(reward);
    const type = rewardTypeBucket(reward);

    if (selected === 'Pending') return isRewardPendingStatus(status);
    if (selected === 'Approved') return isRewardApprovedStatus(status);
    if (selected === 'Rejected') return isRewardRejectedStatus(status);
    if (selected === 'Draft') {
        // Draft card: only drafts the viewer can see (own drafts; admin sees all from API)
        if (!isRewardDraftStatus(status)) return false;
        if (!viewer) return true;
        return isOwnRewardDraft(reward, viewer) || Boolean(viewer?.isAdmin);
    }
    if (selected === 'Cash') return type === 'cash';
    if (selected === 'Gift') return type === 'gift';
    if (selected === 'Certificate') return type === 'certificate';
    return true;
}

export function buildRewardHeaderStats(rewards = []) {
    const list = Array.isArray(rewards) ? rewards : [];
    return {
        total: list.filter((r) => isRewardCountedInTotal(r)).length,
        pending: list.filter((r) => isRewardPendingStatus(r)).length,
        approved: list.filter((r) => isRewardApprovedStatus(r)).length,
        rejected: list.filter((r) => isRewardRejectedStatus(r)).length,
        draft: list.filter((r) => isRewardDraftStatus(r)).length,
        cash: list.filter((r) => rewardTypeBucket(r) === 'cash').length,
        gift: list.filter((r) => rewardTypeBucket(r) === 'gift').length,
        certificate: list.filter((r) => rewardTypeBucket(r) === 'certificate').length,
    };
}

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
