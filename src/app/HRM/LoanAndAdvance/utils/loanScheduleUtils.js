export function resolveLoanRecordStatus(loan) {
    return String(loan?.approvalStatus || loan?.applicationStatus || loan?.status || '').trim();
}

export function isApprovedLoanRecord(loan) {
    const status = resolveLoanRecordStatus(loan);
    return ['Approved', 'Paid'].includes(status);
}

/** Pending loans may appear in New Schedule preview only. */
export function isPendingLoanScheduleStatus(loan) {
    const status = resolveLoanRecordStatus(loan);
    if (!status || status === 'Rejected' || status === 'Cancelled') return false;
    if (isApprovedLoanRecord(loan)) return false;
    return status.toLowerCase().includes('pending');
}

export function getFrozenLoanSchedule(loan) {
    if (!loan) return loan;
    return {
        ...loan,
        monthStart: loan.originalMonthStart || loan.monthStart,
        duration: loan.originalDuration ?? loan.duration,
    };
}

export function isSameEmployeeLoan(a, b) {
    if (!a || !b) return false;
    const aId = a._id || a.id;
    const bId = b._id || b.id;
    if (aId && bId && String(aId) === String(bId)) return true;
    return Boolean(a.loanId && b.loanId && String(a.loanId) === String(b.loanId));
}
