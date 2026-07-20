/**
 * Prefill + helpers for Accounts → Payments (cash reward Zoho payout).
 */

export function isCashOrGiftReward(reward) {
    const type = String(reward?.rewardType || '').toLowerCase();
    return (
        type.includes('cash') ||
        type.includes('gift') ||
        type.includes('bonus') ||
        Number(reward?.amount) > 0
    );
}

export function canAccountsPayCashReward(reward, user) {
    if (!reward || !user) return false;
    if (!isCashOrGiftReward(reward)) return false;
    const status = String(reward.rewardStatus || reward.approvalStatus || '');
    if (status !== 'Approved') return false;
    const amount = Number(reward.amount) || 0;
    const paid = Number(reward.paidAmount) || 0;
    if (amount <= 0 || amount - paid <= 0.01) return false;

    if (user.isAdmin || user.role === 'admin') return true;
    const dept = String(user.department || '').toLowerCase();
    const designation = String(user.designation || '').toLowerCase();
    if (dept.includes('finance') || dept.includes('account')) return true;
    if (designation.includes('account')) return true;
    return false;
}

export function buildRewardPaymentPrefill(reward, { returnTo = '', companyId = '' } = {}) {
    if (!reward) return null;
    const amount = Number(reward.amount) || 0;
    const paid = Number(reward.paidAmount) || 0;
    const balance = Math.max(0, amount - paid);

    return {
        employeeId: reward.employeeId,
        companyId: companyId || '',
        returnTo,
        balance,
        paymentSource: 'Cash',
        reward: {
            _id: reward._id,
            id: reward._id,
            rewardId: reward.rewardId,
            amount: reward.amount,
            paidAmount: reward.paidAmount || 0,
            rewardType: reward.rewardType,
            employeeId: reward.employeeId,
            employeeName: reward.employeeName,
            title: reward.title,
        },
    };
}
