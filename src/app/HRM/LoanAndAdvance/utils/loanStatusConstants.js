/** Set after Management approval — Accounts must pay the employee. */
export const LOAN_PENDING_PAYMENT_STATUS = 'Pending Payment to Employee';

/** Management has approved (legacy `Approved` or awaiting Accounts disbursement). */
export const LOAN_AWAITING_PAYMENT_STATUSES = ['Approved', LOAN_PENDING_PAYMENT_STATUS];

/** Management-approved or fully disbursed (legacy `Paid` still recognized). */
export const LOAN_POST_MANAGEMENT_STATUSES = [
    'Approved',
    LOAN_PENDING_PAYMENT_STATUS,
    'Paid',
];

function resolveLoanStatus(loanOrStatus) {
    if (typeof loanOrStatus === 'string') return String(loanOrStatus || '').trim();
    return String(loanOrStatus?.approvalStatus || loanOrStatus?.status || '').trim();
}

function isLoanAmountFullyPaid(loan) {
    if (!loan || typeof loan === 'string') return false;
    const amount = Number(loan.amount) || 0;
    const paid = Number(loan.paidAmount) || 0;
    return amount > 0 && paid >= amount - 0.01;
}

export function isLoanAwaitingEmployeePayment(loanOrStatus) {
    const status = resolveLoanStatus(loanOrStatus);
    if (status === LOAN_PENDING_PAYMENT_STATUS) return true;
    // Legacy Approved = awaiting only when balance remains
    if (status === 'Approved') {
        if (typeof loanOrStatus === 'object' && loanOrStatus) {
            return !isLoanAmountFullyPaid(loanOrStatus);
        }
        return true;
    }
    return false;
}

export function isLoanPostManagementStatus(loanOrStatus) {
    return LOAN_POST_MANAGEMENT_STATUSES.includes(resolveLoanStatus(loanOrStatus));
}

/** Fully disbursed: Paid to Employee done, or balance cleared (legacy Paid included). */
export function isLoanFullyDisbursed(loan) {
    if (!loan) return false;
    const status = resolveLoanStatus(loan);
    if (status === 'Paid') return true;
    if (isLoanAmountFullyPaid(loan)) return true;
    const workflow = Array.isArray(loan.workflow) ? loan.workflow : [];
    return workflow.some((w) => w?.role === 'Paid to Employee' && w?.status === 'Approved');
}

/** Employee Salary profile: show after Management approve (awaiting pay or paid). */
export function isLoanVisibleOnEmployeeProfile(loan) {
    return isLoanPostManagementStatus(loan);
}

/**
 * Profile/Status label: always Approved after Management (never show Paid as application status).
 */
export function formatLoanProfileStatus(loanOrStatus) {
    const status = resolveLoanStatus(loanOrStatus);
    if (status === 'Paid' || LOAN_POST_MANAGEMENT_STATUSES.includes(status)) {
        return 'Approved';
    }
    return status || '—';
}

export function formatLoanProfilePaymentLabel(loan) {
    if (!loan) return '—';
    if (isLoanFullyDisbursed(loan)) return 'Paid';
    const status = resolveLoanStatus(loan);
    if (isLoanAwaitingEmployeePayment(loan) || status === LOAN_PENDING_PAYMENT_STATUS) {
        return 'Not Paid';
    }
    return '—';
}