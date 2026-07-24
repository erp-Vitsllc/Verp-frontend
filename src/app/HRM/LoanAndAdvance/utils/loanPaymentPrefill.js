import { isLoanAwaitingEmployeePayment } from './loanStatusConstants';

/**
 * Prefill helpers for Accounts → Payments (loan / advance Zoho payout).
 */

function idEquals(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

/**
 * Accounts may pay after Management approval when they are Finance/Accounts
 * (dept/desig), the flowchart Accounts HOD, or the assigned "Paid to Employee" user.
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

    // Live Accounts/Finance HOD for this loan (from detail API)
    if (loan.accountsHODId && idEquals(user.employeeId, loan.accountsHODId)) {
        return true;
    }

    // Assigned via submittedTo / workflow after Management approval
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
