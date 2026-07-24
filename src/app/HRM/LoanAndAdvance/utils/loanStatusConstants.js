/** Set after Management approval — Accounts must pay the employee. */
export const LOAN_PENDING_PAYMENT_STATUS = 'Pending Payment to Employee';

/** Management has approved (legacy `Approved` or awaiting Accounts disbursement). */
export const LOAN_AWAITING_PAYMENT_STATUSES = ['Approved', LOAN_PENDING_PAYMENT_STATUS];

/** Management-approved or fully paid (schedule / attachments / stats). */
export const LOAN_POST_MANAGEMENT_STATUSES = [
    'Approved',
    LOAN_PENDING_PAYMENT_STATUS,
    'Paid',
];

export function isLoanAwaitingEmployeePayment(loanOrStatus) {
    const status =
        typeof loanOrStatus === 'string'
            ? loanOrStatus
            : String(loanOrStatus?.approvalStatus || loanOrStatus?.status || '').trim();
    return LOAN_AWAITING_PAYMENT_STATUSES.includes(status);
}

export function isLoanPostManagementStatus(loanOrStatus) {
    const status =
        typeof loanOrStatus === 'string'
            ? loanOrStatus
            : String(loanOrStatus?.approvalStatus || loanOrStatus?.status || '').trim();
    return LOAN_POST_MANAGEMENT_STATUSES.includes(status);
}
