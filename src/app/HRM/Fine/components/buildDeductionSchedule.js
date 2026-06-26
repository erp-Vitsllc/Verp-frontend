'use client';

import {
    APPROVED_FINE_STATUSES,
    isEndOfServiceFineSource,
    isPaidFineStatus,
    isPendingSchedulePreviewStatus,
    isRejectedFineStatus,
    resolveFineScheduleDuration,
} from '../utils/fineScheduleUtils';
import {
    filterApprovedEmployeeFines,
    isSameEmployeeFine,
    resolveEmployeeFinePaidAmount,
} from '../utils/employeeFineFinancials';
import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';
import {
    getFrozenLoanSchedule,
    isApprovedLoanRecord,
    isPendingLoanScheduleStatus,
    isSameEmployeeLoan,
} from '../../LoanAndAdvance/utils/loanScheduleUtils';

function getYearMonth(val) {
    if (!val) return 0;
    if (typeof val === 'string') {
        if (val.includes('/')) {
            const parts = val.split('/');
            if (parts.length >= 2) {
                const a = parseInt(parts[0], 10);
                const b = parseInt(parts[1], 10);
                if (b > 1000 && a >= 1 && a <= 12) return b * 100 + a;
                if (a > 1000 && b >= 1 && b <= 12) return a * 100 + b;
            }
        }
        if (val.includes('-')) {
            const parts = val.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            if (year > 1000 && month >= 1 && month <= 12) return year * 100 + month;
        }
    }
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.getFullYear() * 100 + (d.getMonth() + 1);
    return 0;
}

function addMonthsToYM(ym, months) {
    if (ym <= 0) return 0;
    let y = Math.floor(ym / 100);
    let m = ym % 100;
    m += months;
    while (m > 12) {
        m -= 12;
        y += 1;
    }
    while (m < 1) {
        m += 12;
        y -= 1;
    }
    return y * 100 + m;
}

export function ymToLabel(ym) {
    const month = ym % 100;
    const year = Math.floor(ym / 100);
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[month - 1]}-${String(year).slice(-2)}`;
}

function ymToLongLabel(ym) {
    const month = ym % 100;
    const year = Math.floor(ym / 100);
    const names = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${names[month - 1]} ${year}`;
}

/** Schedule frozen at approval — Current Deduction Schedule never changes after HR edits. */
export function getFrozenFineSchedule(fine) {
    if (!fine) return fine;
    const duration = fine.originalPayableDuration ?? fine.payableDuration;
    return {
        ...fine,
        monthStart: fine.originalMonthStart || fine.monthStart,
        payableDuration: duration != null ? duration : fine.payableDuration,
    };
}

function emptyMonthEntry() {
    return { total: 0, eos: 0, salary: 0, thisFine: 0, items: [] };
}

/**
 * Employee-level schedules:
 * - Current = approved only (frozen at approval); pending never included.
 * - New = approved (live) + pending preview for the card being viewed only.
 */
function resolveScheduleFines({
    allEmployeeFines,
    employeeId,
    viewingFine,
    viewingLoan,
    mode,
}) {
    const useFrozen = mode === 'current';

    let approved = filterApprovedEmployeeFines(allEmployeeFines, employeeId).map((f) =>
        useFrozen ? getFrozenFineSchedule(f) : f,
    );

    if (mode !== 'new' || !viewingFine || viewingLoan) {
        return approved;
    }

    const status = String(viewingFine.fineStatus || '').trim();
    const isPending = isPendingSchedulePreviewStatus(status);
    const isApprovedViewing = APPROVED_FINE_STATUSES.includes(status);

    if (isPending) {
        if (!approved.some((f) => isSameEmployeeFine(f, viewingFine))) {
            return [...approved, viewingFine];
        }
        return approved.map((f) => (isSameEmployeeFine(f, viewingFine) ? viewingFine : f));
    }

    if (isApprovedViewing) {
        return approved.map((f) => (isSameEmployeeFine(f, viewingFine) ? viewingFine : f));
    }

    return approved;
}

function resolveScheduleLoans({ allEmployeeLoans = [], viewingLoan, mode }) {
    const useFrozen = mode === 'current';

    let approved = allEmployeeLoans
        .filter(isApprovedLoanRecord)
        .map((loan) => (useFrozen ? getFrozenLoanSchedule(loan) : loan));

    if (mode !== 'new' || !viewingLoan) {
        return approved;
    }

    const isPending = isPendingLoanScheduleStatus(viewingLoan);
    const isApprovedViewing = isApprovedLoanRecord(viewingLoan);

    if (isPending) {
        if (!approved.some((loan) => isSameEmployeeLoan(loan, viewingLoan))) {
            return [...approved, viewingLoan];
        }
        return approved.map((loan) => (isSameEmployeeLoan(loan, viewingLoan) ? viewingLoan : loan));
    }

    if (isApprovedViewing) {
        return approved.map((loan) => (isSameEmployeeLoan(loan, viewingLoan) ? viewingLoan : loan));
    }

    return approved;
}

function addEmployeeLoansToMonthMap({ monthMap, loans, viewingLoan }) {
    loans.forEach((loan) => {
        const amount = Number(loan.amount) || 0;
        const paid = Number(loan.paidAmount) || 0;
        const outstanding = amount - paid;
        if (outstanding <= 0) return;

        const duration = Math.max(1, parseInt(loan.duration, 10) || 1);
        const startYM = getYearMonth(loan.monthStart || loan.appliedDate || loan.createdAt);
        if (startYM <= 0) return;

        const monthly = outstanding / duration;
        const label = (loan.type || '').toLowerCase() === 'advance' ? 'Advance' : 'Loan';
        const isThisLoan = viewingLoan && isSameEmployeeLoan(loan, viewingLoan);

        for (let i = 0; i < duration; i++) {
            const ym = addMonthsToYM(startYM, i);
            if (!monthMap.has(ym)) monthMap.set(ym, emptyMonthEntry());
            const entry = monthMap.get(ym);
            entry.total += monthly;
            entry.salary += monthly;
            if (isThisLoan) {
                entry.thisFine += monthly;
            }
            entry.items.push({
                fineId: loan.loanId || label,
                amount: monthly,
                source: 'Salary',
            });
        }
    });
}

export function buildMonthBoxes({
    fine,
    employeeId,
    fineSummaries,
    allEmployeeFines = [],
    allEmployeeLoans = [],
    viewingLoan = null,
    mode = 'current',
}) {
    const scheduleFines = resolveScheduleFines({
        allEmployeeFines,
        employeeId,
        viewingFine: fine,
        viewingLoan,
        mode,
    });
    const monthMap = new Map();

    scheduleFines.forEach((record) => {
        const source = record.sourceOfIncome || 'Salary';
        const isEos = isEndOfServiceFineSource(source);

        const share = resolveEmployeeFinePayableAmount(record, employeeId);
        if (share <= 0) return;

        const paid = resolveEmployeeFinePaidAmount(record, employeeId, share);
        const outstanding = share - paid;
        if (outstanding <= 0) return;

        const startYM = getYearMonth(
            record.monthStart || record.awardedDate || record.fineDate || record.createdAt,
        );
        const duration = resolveFineScheduleDuration(record);
        if (startYM <= 0) return;

        const monthly = outstanding / duration;
        const isThisFine = fine && isSameEmployeeFine(record, fine);

        for (let i = 0; i < duration; i++) {
            const ym = addMonthsToYM(startYM, i);
            if (!monthMap.has(ym)) monthMap.set(ym, emptyMonthEntry());
            const entry = monthMap.get(ym);
            entry.total += monthly;
            if (isEos) {
                entry.eos = (entry.eos || 0) + monthly;
            } else {
                entry.salary += monthly;
            }
            if (isThisFine) {
                entry.thisFine += monthly;
            }
            entry.items.push({
                fineId: record.fineId || 'Fine',
                amount: monthly,
                source,
            });
        }
    });

    const scheduleLoans = resolveScheduleLoans({
        allEmployeeLoans,
        viewingLoan,
        mode,
    });

    if (scheduleLoans.length) {
        addEmployeeLoansToMonthMap({ monthMap, loans: scheduleLoans, viewingLoan });
    }

    const boxes = Array.from(monthMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([ym, data]) => ({
            ym,
            label: ymToLabel(ym),
            longLabel: ymToLongLabel(ym),
            total: Math.round(data.total),
            sourceLabel: '',
            detailAmount: data.thisFine > 0 ? Math.round(data.thisFine) : null,
            isThisFineMonth: data.thisFine > 0,
            isEos: (data.eos || 0) > 0 && (data.salary || 0) <= 0,
            items: data.items.map((item) => ({
                ...item,
                amount: Math.round(item.amount),
            })),
        }));

    return { boxes, eosBoxes: [], mode };
}

export function buildCurrentDeductionSchedule(props) {
    return buildMonthBoxes({ ...props, mode: 'current' });
}

export function buildNewDeductionSchedule(props) {
    return buildMonthBoxes({ ...props, mode: 'new' });
}

export function getDeductionScheduleSubtitles(fine, viewingLoan = null) {
    if (viewingLoan && isPendingLoanScheduleStatus(viewingLoan)) {
        return {
            current: 'Approved fines, loans and advances only — this pending application is excluded.',
            new: 'Preview: all approved obligations plus this pending loan/advance at your set month and duration.',
        };
    }

    if (!fine) {
        return {
            current: 'All approved fines for this employee — same-month deductions are combined.',
            new: 'Approved obligations only — pending item preview appears on that item\'s card.',
        };
    }

    if (isPaidFineStatus(fine.fineStatus) || isRejectedFineStatus(fine.fineStatus)) {
        return {
            current: 'Approved fines for this employee — schedule locked at approval.',
            new: 'Same as current schedule (fine is paid or rejected).',
        };
    }

    if (isPendingSchedulePreviewStatus(fine.fineStatus)) {
        return {
            current: 'Same as all other cards — approved fines, loans and advances only.',
            new: 'Preview: all approved obligations plus this pending fine at your set month and duration.',
        };
    }

    return {
        current: 'Approved obligations frozen at approval — pending items are excluded.',
        new: 'Live preview — includes HR schedule edits; becomes current after approval.',
    };
}
