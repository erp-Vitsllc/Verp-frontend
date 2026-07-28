import {
    getLoanRepaymentBalance,
    isLoanAwaitingEmployeePayment,
    isLoanPostManagementStatus,
} from './loanStatusConstants';

/**
 * Prefill helpers for Accounts → Payments (loan / advance Zoho payout).
 */

function idEquals(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

function isAccountsFinanceUser(user) {
    if (!user) return false;
    if (user.isAdmin || user.role === 'admin') return true;

    const dept = String(user.department || '').toLowerCase();
    const designation = String(user.designation || '').toLowerCase();
    if (
        dept.includes('finance') ||
        dept.includes('account') ||
        dept.includes('payroll') ||
        designation.includes('account') ||
        designation.includes('finance') ||
        designation.includes('payroll')
    ) {
        return true;
    }
    return false;
}

function matchesLoanAccountsAssignee(loan, user) {
    if (!loan || !user) return false;

    if (loan.accountsHODId && idEquals(user.employeeId, loan.accountsHODId)) {
        return true;
    }

    if (
        idEquals(user._id || user.id, loan.submittedTo) ||
        idEquals(user.employeeObjectId, loan.submittedTo)
    ) {
        return true;
    }

    const payStep = (Array.isArray(loan.workflow) ? loan.workflow : []).find(
        (w) => w?.role === 'Paid to Employee' && String(w?.status || '') === 'Pending',
    );
    if (payStep?.assignedTo) {
        if (
            idEquals(payStep.assignedTo, user._id || user.id) ||
            idEquals(payStep.assignedTo, user.employeeObjectId) ||
            idEquals(payStep.assignedTo?._id, user._id || user.id) ||
            idEquals(payStep.assignedTo?._id, user.employeeObjectId)
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Accounts may disburse after Management approval (Loan detail / Accounts Payments).
 */
export function canAccountsPayLoan(loan, user) {
    if (!loan || !user) return false;
    if (!isLoanAwaitingEmployeePayment(loan)) return false;
    const amount = Number(loan.amount) || 0;
    const paid = Number(loan.paidAmount) || 0;
    if (amount <= 0 || amount - paid <= 0.01) return false;

    return isAccountsFinanceUser(user) || matchesLoanAccountsAssignee(loan, user);
}

/**
 * Employee profile Pay: collect loan/advance repayment (Expense Refund → Zoho Banking).
 */
export function canAccountsCollectLoanRepayment(loan, user) {
    if (!loan || !user) return false;
    if (!isLoanPostManagementStatus(loan)) return false;
    if (getLoanRepaymentBalance(loan) <= 0.01) return false;
    return isAccountsFinanceUser(user) || matchesLoanAccountsAssignee(loan, user);
}

export function buildLoanPaymentPrefill(loan, { returnTo = '', companyId = '' } = {}) {
    if (!loan) return null;
    const amount = Number(loan.amount) || 0;
    const paid = Number(loan.paidAmount) || 0;
    const balance = Math.max(0, amount - paid);
    const type = loan.type === 'Advance' ? 'Advance' : 'Loan';

    return {
        employeeId: loan.employeeId,
        companyId: companyId || '',
        returnTo,
        balance,
        paymentSource: 'Cash',
        organizationId: loan.zohoOrganizationId || '',
        expenseAccountId: loan.expenseAccountId || '',
        expenseAccountName: loan.expenseAccountName || '',
        paidThroughAccountId: loan.paidThroughAccountId || '',
        paidThroughAccountName: loan.paidThroughAccountName || '',
        loan: {
            _id: loan._id,
            id: loan._id,
            loanId: loan.loanId,
            amount: loan.amount,
            paidAmount: loan.paidAmount || 0,
            duration: loan.duration,
            monthStart: loan.monthStart,
            type,
            employeeId: loan.employeeId,
            zohoOrganizationId: loan.zohoOrganizationId || '',
            expenseAccountId: loan.expenseAccountId || '',
            expenseAccountName: loan.expenseAccountName || '',
            paidThroughAccountId: loan.paidThroughAccountId || '',
            paidThroughAccountName: loan.paidThroughAccountName || '',
        },
    };
}
