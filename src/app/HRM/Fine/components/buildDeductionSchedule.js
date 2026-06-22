'use client';

import {
    APPROVED_FINE_STATUSES,
    isPaidFineStatus,
    isPendingSchedulePreviewStatus,
    isRejectedFineStatus,
} from '../utils/fineScheduleUtils';
import {
    filterApprovedEmployeeFines,
    isSameEmployeeFine,
    resolveEmployeeFinePaidAmount,
} from '../utils/employeeFineFinancials';
import { resolveEmployeeFinePayableAmount } from '@/utils/finePayableAmount';

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

function isViewingFineFullyPaid(viewingFine, employeeId) {
    if (!viewingFine || !employeeId) return false;
    const share = resolveEmployeeFinePayableAmount(viewingFine, employeeId);
    if (share <= 0) return false;
    const paid = resolveEmployeeFinePaidAmount(viewingFine, employeeId, share);
    return share - paid <= 0;
}

/**
 * Paid / rejected / fully-paid fines: New Schedule mirrors Current (frozen approved only).
 * Pending fines: only New Schedule includes the viewing fine (live edits); Current stays approved-only.
 * Approved fines with outstanding: Current = frozen at approval, New = live (HR schedule edits).
 */
function shouldMirrorCurrentSchedule(viewingFine, employeeId) {
    if (!viewingFine) return false;
    const status = viewingFine.fineStatus;
    if (isPaidFineStatus(status) || isRejectedFineStatus(status)) return true;
    if (APPROVED_FINE_STATUSES.includes(status) && isViewingFineFullyPaid(viewingFine, employeeId)) {
        return true;
    }
    return false;
}

function resolveScheduleFines({
    allEmployeeFines,
    employeeId,
    viewingFine,
    mode,
}) {
    const mirrorCurrent = shouldMirrorCurrentSchedule(viewingFine, employeeId);
    const useFrozen = mirrorCurrent || mode === 'current';

    const approved = filterApprovedEmployeeFines(allEmployeeFines, employeeId).map((f) =>
        useFrozen ? getFrozenFineSchedule(f) : f,
    );

    const includePendingPreview =
        !mirrorCurrent &&
        mode === 'new' &&
        viewingFine &&
        isPendingSchedulePreviewStatus(viewingFine.fineStatus) &&
        !approved.some((f) => isSameEmployeeFine(f, viewingFine));

    if (includePendingPreview) {
        return [...approved, viewingFine];
    }

    return approved;
}

function loanMonthly(agg) {
    const amount = parseFloat(agg.amount) || 0;
    const paid = parseFloat(agg.paid) || 0;
    const duration = Math.max(1, parseInt(agg.duration, 10) || 1);
    if (amount - paid <= 0) return 0;
    return amount / duration;
}

function emptyMonthEntry() {
    return { total: 0, eos: 0, salary: 0, thisFine: 0, items: [] };
}

function addLoanMonths(monthMap, agg, label, startYM) {
    const monthly = loanMonthly(agg);
    const duration = Math.max(1, parseInt(agg.duration, 10) || 1);
    if (monthly <= 0 || startYM <= 0) return;

    for (let i = 0; i < duration; i++) {
        const ym = addMonthsToYM(startYM, i);
        if (!monthMap.has(ym)) monthMap.set(ym, emptyMonthEntry());
        const entry = monthMap.get(ym);
        entry.total += monthly;
        entry.salary += monthly;
        entry.items.push({ fineId: label, amount: monthly, source: 'Salary' });
    }
}

function resolveLoanStartYM({ viewingFine, fineSummaries, monthMap, mode, employeeId }) {
    const monthKeys = [...monthMap.keys()];
    const mirrorCurrent = shouldMirrorCurrentSchedule(viewingFine, employeeId);
    const useFrozen = mirrorCurrent || mode === 'current';

    if (viewingFine) {
        const record = useFrozen ? getFrozenFineSchedule(viewingFine) : viewingFine;
        return (
            getYearMonth(record.monthStart || record.awardedDate) ||
            getYearMonth(fineSummaries?.startMonthYear) ||
            (monthKeys.length ? Math.min(...monthKeys) : 0)
        );
    }
    return (
        getYearMonth(fineSummaries?.startMonthYear) ||
        (monthKeys.length ? Math.min(...monthKeys) : 0)
    );
}

export function buildMonthBoxes({
    fine,
    employeeId,
    fineSummaries,
    allEmployeeFines = [],
    mode = 'current',
}) {
    const scheduleFines = resolveScheduleFines({
        allEmployeeFines,
        employeeId,
        viewingFine: fine,
        mode,
    });
    const monthMap = new Map();

    scheduleFines.forEach((record) => {
        const share = resolveEmployeeFinePayableAmount(record, employeeId);
        if (share <= 0) return;

        const paid = resolveEmployeeFinePaidAmount(record, employeeId, share);
        const outstanding = share - paid;
        if (outstanding <= 0) return;

        const startYM = getYearMonth(record.monthStart || record.awardedDate);
        const duration = Math.max(1, parseInt(record.payableDuration, 10) || 1);
        if (startYM <= 0) return;

        const monthly = outstanding / duration;
        const source = record.sourceOfIncome || 'Salary';
        const isThisFine = fine && isSameEmployeeFine(record, fine);

        for (let i = 0; i < duration; i++) {
            const ym = addMonthsToYM(startYM, i);
            if (!monthMap.has(ym)) monthMap.set(ym, emptyMonthEntry());
            const entry = monthMap.get(ym);
            entry.total += monthly;
            if (source === 'End of Service') {
                entry.eos += monthly;
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

    const loanStartYM = resolveLoanStartYM({
        viewingFine: fine,
        fineSummaries,
        monthMap,
        mode,
        employeeId,
    });
    if (loanStartYM > 0) {
        addLoanMonths(monthMap, fineSummaries?.salaryAdvance, 'Advance', loanStartYM);
        addLoanMonths(monthMap, fineSummaries?.personalLoan, 'Loan', loanStartYM);
    }

    const boxes = Array.from(monthMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([ym, data]) => ({
            ym,
            label: ymToLabel(ym),
            longLabel: ymToLongLabel(ym),
            total: Math.round(data.total),
            sourceLabel: data.eos > 0 ? 'End of Service' : '',
            detailAmount: data.thisFine > 0 ? Math.round(data.thisFine) : null,
            isThisFineMonth: data.thisFine > 0,
            items: data.items.map((item) => ({
                ...item,
                amount: Math.round(item.amount),
            })),
        }));

    return { boxes, mode };
}

export function buildCurrentDeductionSchedule(props) {
    return buildMonthBoxes({ ...props, mode: 'current' });
}

export function buildNewDeductionSchedule(props) {
    return buildMonthBoxes({ ...props, mode: 'new' });
}

export function getDeductionScheduleSubtitles(fine) {
    if (!fine) {
        return {
            current: 'All approved fines for this employee — same-month deductions are combined.',
            new: 'Approved fines for this employee — pending fine added when reviewing approval.',
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
            current: 'Approved fines only — pending fine not included until approved.',
            new: 'Includes this pending fine with your current schedule edits (preview).',
        };
    }

    return {
        current: 'Approved fines frozen at approval — HR schedule edits appear in New Schedule only.',
        new: 'Live schedule including any HR edits to this or other approved fines.',
    };
}
