'use client';

function getYearMonth(val) {
    if (!val) return 0;
    if (typeof val === 'string') {
        if (val.includes('/')) {
            const [m, y] = val.split('/');
            const month = parseInt(m, 10);
            const year = parseInt(y, 10);
            if (year > 1000 && month >= 1 && month <= 12) return year * 100 + month;
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

function isSameFine(a, b) {
    if (!a || !b) return false;
    return (a._id && b._id && a._id === b._id) || (a.fineId && b.fineId && a.fineId === b.fineId);
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

/**
 * Current = all fines using the viewing fine's original schedule (at approval).
 * New = all fines using live data — reflects HR edits to this fine's schedule.
 */
function resolveActiveFines(allEmployeeFines, fine, mode) {
    const approved = (allEmployeeFines || []).filter((f) =>
        ['Approved', 'Active', 'Paid', 'Completed'].includes(f.fineStatus),
    );

    if (!fine) return approved;

    const without = approved.filter((f) => !isSameFine(f, fine));
    const viewingRecord = mode === 'current' ? getFrozenFineSchedule(fine) : fine;

    if (['Approved', 'Active', 'Paid', 'Completed'].includes(fine.fineStatus)) {
        return [...without, viewingRecord];
    }

    return without;
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

function resolveLoanStartYM({ fine, fineSummaries, monthMap, mode }) {
    const monthKeys = [...monthMap.keys()];
    if (mode === 'current' && fine) {
        const frozen = getFrozenFineSchedule(fine);
        return (
            getYearMonth(frozen.monthStart || frozen.awardedDate) ||
            getYearMonth(fineSummaries?.startMonthYear) ||
            (monthKeys.length ? Math.min(...monthKeys) : 0)
        );
    }
    if (mode === 'new' && fine) {
        return (
            getYearMonth(fine.monthStart || fine.awardedDate) ||
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
    fineSummaries,
    allEmployeeFines = [],
    getEmpShare,
    mode = 'current',
}) {
    const activeFines = resolveActiveFines(allEmployeeFines, fine, mode);
    const monthMap = new Map();

    activeFines.forEach((f) => {
        const record = f;
        const share = getEmpShare ? getEmpShare(record) : 0;
        if (share <= 0) return;

        const outstanding = share - (parseFloat(record.paidAmount) || 0);
        if (outstanding <= 0) return;

        const startYM = getYearMonth(record.monthStart || record.awardedDate);
        const duration = Math.max(1, parseInt(record.payableDuration, 10) || 1);
        if (startYM <= 0) return;

        const monthly = share / duration;
        const source = record.sourceOfIncome || 'Salary';
        const isThisFine = fine && isSameFine(record, fine);

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

    const loanStartYM = resolveLoanStartYM({ fine, fineSummaries, monthMap, mode });
    if (loanStartYM > 0) {
        addLoanMonths(monthMap, fineSummaries?.salaryAdvance, 'Advance', loanStartYM);
        addLoanMonths(monthMap, fineSummaries?.personalLoan, 'Loan', loanStartYM);
    }

    const boxes = Array.from(monthMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([ym, data]) => {
            const sourceLabel = data.eos > 0 ? 'End of Service' : '';
            const detailAmount = data.thisFine > 0 ? Math.round(data.thisFine) : Math.round(data.salary);

            return {
                ym,
                label: ymToLabel(ym),
                longLabel: ymToLongLabel(ym),
                total: Math.round(data.total),
                sourceLabel,
                detailAmount: detailAmount > 0 ? detailAmount : null,
                isThisFineMonth: data.thisFine > 0,
                items: data.items.map((item) => ({
                    ...item,
                    amount: Math.round(item.amount),
                })),
            };
        });

    return { boxes, mode };
}

export function buildCurrentDeductionSchedule(props) {
    return buildMonthBoxes({ ...props, mode: 'current' });
}

export function buildNewDeductionSchedule(props) {
    return buildMonthBoxes({ ...props, mode: 'new' });
}
