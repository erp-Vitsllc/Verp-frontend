import { isLoanAwaitingEmployeePayment } from './loanStatusConstants';

/**
 * Prefill helpers for Accounts → Payments (loan / advance Zoho payout).
 */

export function canAccountsPayLoan(loan, user) {
    if (!loan || !user) return false;
    const status = String(loan.approvalStatus || loan.status || '');
    // Only after Management approval (Pending Payment to Employee, or legacy Approved)
    if (!isLoanAwaitingEmployeePayment(status)) return false;
    const amount = Number(loan.amount) || 0;
    const paid = Number(loan.paidAmount) || 0;
    if (amount <= 0 || amount - paid <= 0.01) return false;

    if (user.isAdmin || user.role === 'admin') return true;
    const dept = String(user.department || '').toLowerCase();
    const designation = String(user.designation || '').toLowerCase();
    if (dept.includes('finance') || dept.includes('account')) return true;
    if (designation.includes('account')) return true;
    return false;
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
            expenseAccountId: loan.expenseAccountId || '',
            expenseAccountName: loan.expenseAccountName || '',
            paidThroughAccountId: loan.paidThroughAccountId || '',
            paidThroughAccountName: loan.paidThroughAccountName || '',
        },
    };
}
