import { buildEmployeeFinancials } from './employeeFineFinancials';
import { deriveFineScheduleMonthYears } from './fineScheduleUtils';
import { isApprovedLoanRecord } from '../../LoanAndAdvance/utils/loanScheduleUtils';

export const EMPTY_EMPLOYEE_FORM_SUMMARIES = {
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

/**
 * Employee-level payment summary inputs — identical on every fine / loan / advance card.
 */
export function buildEmployeeFormSummaries({
    allEmployeeFines = [],
    allEmployeeLoans = [],
    employeeId,
    scheduleAnchorRecord = null,
}) {
    if (!employeeId) return { ...EMPTY_EMPLOYEE_FORM_SUMMARIES };

    const approvedLoans = allEmployeeLoans.filter(isApprovedLoanRecord);
    const loanSummary = {
        personalLoan: summarizeLoansByType(approvedLoans, 'loan'),
        salaryAdvance: summarizeLoansByType(approvedLoans, 'advance'),
    };

    const financials = buildEmployeeFinancials({
        allEmployeeFines,
        employeeId,
        loanSummary,
    });

    const scheduleDates = scheduleAnchorRecord
        ? deriveFineScheduleMonthYears(scheduleAnchorRecord)
        : { startMonthYear: '-', endMonthYear: '-' };

    return {
        ...EMPTY_EMPLOYEE_FORM_SUMMARIES,
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
