import { buildEmployeeFinancials } from '../../Fine/utils/employeeFineFinancials';
import { deriveFineScheduleMonthYears } from '../../Fine/utils/fineScheduleUtils';
import { isApprovedLoanRecord } from './loanScheduleUtils';

export const EMPTY_LOAN_FORM_SUMMARIES = {
    totalFineCount: 0,
    totalAmount: 0,
    paidFineCount: 0,
    paidFineAmount: 0,
    outstandingBalance: 0,
    distinctTypesCount: 0,
    startMonthYear: '-',
    endMonthYear: '-',
    personalLoan: { amount: 0, duration: 0, paid: 0, count: 0 },
    salaryAdvance: { amount: 0, duration: 0, paid: 0, count: 0 },
    aggregates: {
        Vehicle: { amount: 0, paid: 0, count: 0, duration: 0 },
        Safety: { amount: 0, paid: 0, count: 0, duration: 0 },
        Project: { amount: 0, paid: 0, count: 0, duration: 0 },
        Loss: { amount: 0, paid: 0, count: 0, duration: 0 },
        Other: { amount: 0, paid: 0, count: 0, duration: 0 },
    },
};

function summarizeLoansByType(loans, type) {
    const filtered = loans.filter((l) => (l.type || '').toLowerCase() === type.toLowerCase());
    return {
        amount: filtered.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
        duration: filtered.reduce((sum, l) => sum + (Number(l.duration) || 0), 0),
        paid: filtered.reduce((sum, l) => sum + (Number(l.paidAmount) || 0), 0),
        count: filtered.length,
    };
}

export function loanToScheduleView(loan) {
    if (!loan) return null;

    const status = loan.approvalStatus || loan.status || '';

    return {
        _id: loan._id || loan.id,
        fineId: loan.loanId,
        fineStatus: status,
        monthStart: loan.monthStart,
        originalMonthStart: loan.originalMonthStart || loan.monthStart,
        payableDuration: loan.duration,
        originalPayableDuration: loan.originalDuration ?? loan.duration,
        awardedDate: loan.appliedDate || loan.createdAt,
    };
}

export function buildLoanFormSummaries({ allEmployeeFines = [], allLoans = [], employeeId, currentLoan }) {
    if (!employeeId) return { ...EMPTY_LOAN_FORM_SUMMARIES };

    const approvedLoans = allLoans.filter(isApprovedLoanRecord);
    const loanSummary = {
        personalLoan: summarizeLoansByType(approvedLoans, 'loan'),
        salaryAdvance: summarizeLoansByType(approvedLoans, 'advance'),
    };

    const financials = buildEmployeeFinancials({
        allEmployeeFines,
        employeeId,
        loanSummary,
    });

    const scheduleDates = deriveFineScheduleMonthYears(
        loanToScheduleView(currentLoan) || {},
    );

    return {
        ...EMPTY_LOAN_FORM_SUMMARIES,
        startMonthYear: scheduleDates.startMonthYear,
        endMonthYear: scheduleDates.endMonthYear,
        aggregates: financials.aggregates,
        totalFineCount: financials.totalFineCount,
        totalAmount: financials.totalAmount,
        paidFineAmount: financials.paidFineAmount,
        outstandingBalance: financials.outstandingBalance,
        personalLoan: loanSummary.personalLoan,
        salaryAdvance: loanSummary.salaryAdvance,
    };
}
