import { buildEmployeeFormSummaries } from '../../Fine/utils/buildEmployeeFormSummaries';

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

export function loanToScheduleView(loan) {
    if (!loan) return null;

    const status = loan.approvalStatus || loan.applicationStatus || loan.status || '';

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
    return buildEmployeeFormSummaries({
        allEmployeeFines,
        allEmployeeLoans: allLoans,
        employeeId,
        scheduleAnchorRecord: loanToScheduleView(currentLoan) || null,
    });
}
