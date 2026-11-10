const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const EXTRA_EARNING = /overtime|leave salary|ticket|reward/i;

export const SALARY_EARNING_CATALOG = [
    'Basic Salary',
    'Other Allowance',
    'House Rental Allowance',
    'Vehicle Allowance',
    'Fuel Allowance',
];

export const OTHER_EARNING_CATALOG = [
    'Overtime Hours',
    'Overtime Days',
    'Leave Salary',
    'Ticket',
    'Reward',
    'Phone Allowance',
];

export const YEARLY_SALARY_EARNING_CATALOG = [...SALARY_EARNING_CATALOG];

export const YEARLY_OTHER_EARNING_CATALOG = [
    'Reward',
    'End of Service Benefit(yearly)',
    'Leave Salary',
    'Travel Allowance',
];

export const EARNING_CATALOG = [...SALARY_EARNING_CATALOG, ...OTHER_EARNING_CATALOG];

export function isOtherEarning(name) {
    const text = String(name || '');
    return EXTRA_EARNING.test(text) || /phone/i.test(text);
}

export const DEDUCTION_CATALOG = [
    'Authorized Leave',
    'Unauthorized Leave',
    'Sick Leave',
    'Annual Leave',
    'Suspended',
    'Late Arrival',
    'Early Out',
    'Salary Advance',
    'Loan',
    'Fine',
    'Utility Excess',
];

export const LOSS_OF_PAY_CATALOG = [
    'Authorized Leave',
    'Unauthorized Leave',
    'Sick Leave',
    'Late Arrival',
    'Early Out',
    'Annual Leave',
    'Suspended',
];

export const OTHER_DEDUCTION_CATALOG = [
    'Loan',
    'Fine',
    'Utility Excess',
    'Salary Advance',
];

export function money(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100) / 100;
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function formatAed(value) {
    return `AED ${money(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Salary + other earnings this month − loss of pay. */
export function salaryPayableZoho(salaryEarnings, otherEarnings, lossOfPay) {
    return money(salaryEarnings + otherEarnings - lossOfPay);
}

/** Zoho payable − this month's other deductions (loan / fine / utility / advance installments). */
export function actualSalaryAfterDeduction(payableZoho, otherDeductions) {
    return money(Math.max(0, payableZoho - otherDeductions));
}

function sumMoney(rows, read) {
    return money((Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + money(read(row)), 0));
}

function isApprovedLiability(row) {
    if (!row) return false;
    if (row.approved === false) return false;
    const total = money(row.originalAmount ?? row.original ?? row.amount ?? row.total);
    const thisMonth = money(row.thisMonthAmount ?? row.thisMonth);
    return total > 0 || thisMonth > 0 || row.approved === true;
}

/** Settled only when the row is fully paid. Partially paid balances stay open. */
function liabilityMarkedPaid(row) {
    const status = String(row?.unpaidStatus || row?.status || '').trim().toLowerCase();
    if (!status || status.includes('not paid') || status.includes('partial')) return false;
    return /\bpaid\b/.test(status);
}

/** Full amount this employee still has to pay. Not paid and partially paid both count. */
function outstandingOfLiability(row, readTotal, readPaid) {
    if (!row || liabilityMarkedPaid(row)) return 0;
    if (row.remainingAmount != null && row.remainingAmount !== '') {
        return money(Math.max(0, money(row.remainingAmount)));
    }
    const original = money(readTotal(row));
    const paid = money(typeof readPaid === 'function' ? readPaid(row) : 0);
    if (original > 0 || paid > 0) return money(Math.max(0, original - paid));
    if (row.dueAmount != null && row.dueAmount !== '') {
        return money(Math.max(0, money(row.dueAmount)));
    }
    return 0;
}

/** This salary month's scheduled share. The entered deduction can be higher, up to the outstanding balance. */
function monthShareOf(row) {
    if (!row || liabilityMarkedPaid(row)) return 0;
    if (row.monthShare != null && row.monthShare !== '') return money(Math.max(0, row.monthShare));
    return money(row.thisMonthAmount ?? row.thisMonth);
}

function liabilitySummary(type, rows, readTotal, readPaid, readThisMonth) {
    const list = (Array.isArray(rows) ? rows : []).filter(isApprovedLiability);
    const open = list.filter((row) => outstandingOfLiability(row, readTotal, readPaid) > 0);
    const total = money(open.reduce((sum, row) => sum + outstandingOfLiability(row, readTotal, readPaid), 0));
    const monthShare = money(open.reduce((sum, row) => sum + monthShareOf(row), 0));
    const thisMonthDeduction = money(Math.min(sumMoney(list, readThisMonth), total));
    return {
        type,
        count: open.length,
        label: `${type} (${open.length})`,
        total,
        monthShare,
        thisMonthDeduction,
        remainingAfterDeduction: money(Math.max(0, total - thisMonthDeduction)),
    };
}

/** This-month deduction can be any amount up to the outstanding balance. */
export function clampThisMonthDeduction(value, limit) {
    const cap = money(limit);
    if (cap <= 0) return 0;
    return money(Math.min(Math.max(0, money(value)), cap));
}

function allocateThisMonth(rows, requested, predicate) {
    const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    const targets = list.filter((row) => (!predicate || predicate(row)) && isApprovedLiability(row));
    const weights = targets.map((row) => {
        if (row.remainingAmount != null && row.remainingAmount !== '') {
            return money(Math.max(0, row.remainingAmount));
        }
        if (row.dueAmount != null && row.dueAmount !== '') {
            return money(Math.max(0, row.dueAmount));
        }
        return monthShareOf(row);
    });
    const cap = money(weights.reduce((sum, value) => sum + value, 0));
    let left = clampThisMonthDeduction(requested, cap);
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    targets.forEach((row, index) => {
        const share = weightSum <= 0
            ? 0
            : index === targets.length - 1
                ? money(left - allocated)
                : money((left * weights[index]) / weightSum);
        const capped = Math.min(Math.max(0, share), weights[index]);
        row.thisMonthAmount = capped;
        row.thisMonth = formatAed(capped);
        allocated = money(allocated + capped);
    });
    return list;
}

const THIS_MONTH_READERS = {
    Fine: {
        listKey: 'fines',
        predicate: null,
        readTotal: (row) => row.originalAmount ?? row.amount,
        readPaid: (row) => row.paidAmount ?? row.paid,
        overrideKey: 'Fine',
    },
    Loan: {
        listKey: 'loanSchedule',
        predicate: (row) => !/advance/i.test(String(row?.type || '')),
        readTotal: (row) => row.originalAmount ?? row.original ?? row.amount,
        readPaid: (row) => row.paidAmount ?? row.paidToDate ?? row.paid,
        overrideKey: 'Loan',
    },
    Utility: {
        listKey: 'utilities',
        predicate: null,
        readTotal: (row) => row.originalAmount ?? row.total ?? row.amount,
        readPaid: (row) => row.paidAmount ?? row.paid,
        overrideKey: 'Utility',
    },
    'Salary Advance': {
        listKey: 'loanSchedule',
        predicate: (row) => /advance/i.test(String(row?.type || '')),
        readTotal: (row) => row.originalAmount ?? row.original ?? row.amount,
        readPaid: (row) => row.paidAmount ?? row.paidToDate ?? row.paid,
        overrideKey: 'Salary Advance',
    },
};

export function applyCategoryThisMonthOnDraft(draft, type, rawAmount) {
    const spec = THIS_MONTH_READERS[type];
    if (!spec || !draft) return draft;
    draft[spec.listKey] = allocateThisMonth(
        draft[spec.listKey],
        rawAmount,
        spec.predicate,
    );
    draft.thisMonthOverrides = {
        ...(draft.thisMonthOverrides || {}),
        [spec.overrideKey]: true,
    };
    return draft;
}

/**
 * Open loan, fine, utility and salary advance for this employee.
 * Total outstanding is the full not-paid or partially paid balance.
 * This month deduction can be any amount up to that outstanding balance.
 */
export function buildSalarySlipBalanceRows(slip) {
    const loans = Array.isArray(slip?.loanSchedule) ? slip.loanSchedule : [];
    const advances = loans.filter((row) => /advance/i.test(String(row?.type || '')));
    const loanRows = loans.filter((row) => !/advance/i.test(String(row?.type || '')));
    const fines = Array.isArray(slip?.fines) ? slip.fines : [];
    const utilities = Array.isArray(slip?.utilities) ? slip.utilities : [];

    return [
        liabilitySummary(
            'Loan',
            loanRows,
            (row) => row.originalAmount ?? row.original ?? row.amount,
            (row) => row.paidAmount ?? row.paidToDate ?? row.paid,
            (row) => row.thisMonthAmount ?? row.thisMonth,
        ),
        liabilitySummary(
            'Fine',
            fines,
            (row) => row.originalAmount ?? row.amount,
            (row) => row.paidAmount ?? row.paid,
            (row) => row.thisMonthAmount ?? row.thisMonth,
        ),
        liabilitySummary(
            'Utility',
            utilities,
            (row) => row.originalAmount ?? row.total ?? row.amount,
            (row) => row.paidAmount ?? row.paid,
            (row) => row.thisMonthAmount ?? row.thisMonth,
        ),
        liabilitySummary(
            'Salary Advance',
            advances,
            (row) => row.originalAmount ?? row.original ?? row.amount,
            (row) => row.paidAmount ?? row.paidToDate ?? row.paid,
            (row) => row.thisMonthAmount ?? row.thisMonth,
        ),
    ];
}

export function componentMatches(component, name) {
    const a = String(component || '').trim().toLowerCase();
    const b = String(name || '').trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if ((a === 'late out' || a === 'early out') && (b === 'late out' || b === 'early out')) return true;
    if (b === 'fine' && a.startsWith('fine')) return true;
    if (b === 'utility excess' && a.includes('utility')) return true;
    if (b === 'sick leave' && (a === 'sick' || a.startsWith('sick'))) return true;
    if (b === 'phone allowance' && a.includes('phone')) return true;
    if (
        (b.includes('house rent') || b.includes('accommodation')) &&
        (a.includes('house rent') || a.includes('accommodation'))
    ) {
        return true;
    }
    if (b === 'vehicle allowance' && a.includes('vehicle')) return true;
    if (b === 'fuel allowance' && a.includes('fuel')) return true;
    if (
        b === 'travel allowance' &&
        (a.includes('travel') || a === 'ticket' || a.includes('ticket'))
    ) {
        return true;
    }
    if (
        (b.includes('end of service') || b.includes('gratuity') || b.includes('eosb')) &&
        (a.includes('end of service') || a.includes('gratuity') || a.includes('eosb'))
    ) {
        return true;
    }
    return false;
}

export function pickComponent(rows, name) {
    const found = (Array.isArray(rows) ? rows : []).find((row) => componentMatches(row?.component, name));
    return found || { component: name, basis: '', amount: 0 };
}

export function mapComponent(rows, name, patch) {
    const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    const idx = list.findIndex((row) => componentMatches(row?.component, name));
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...patch };
        return list;
    }
    list.push({ component: name, basis: '', amount: 0, ...patch });
    return list;
}

export function extraComponents(rows, catalog) {
    return (Array.isArray(rows) ? rows : []).filter(
        (row) => !catalog.some((name) => componentMatches(row?.component, name)),
    );
}

function groupWords(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (hundred) parts.push(`${ONES[hundred]} Hundred`);
    if (rest >= 10 && rest < 20) {
        parts.push(TEENS[rest - 10]);
    } else if (rest >= 20) {
        const ten = TENS[Math.floor(rest / 10)];
        const one = ONES[rest % 10];
        parts.push(one ? `${ten}-${one}` : ten);
    } else if (rest > 0) {
        parts.push(ONES[rest]);
    }
    return parts.join(' ');
}

export function amountInWordsAed(value) {
    const amount = Math.max(0, money(value));
    const dirhams = Math.floor(amount);
    const fils = Math.round((amount - dirhams) * 100);
    if (dirhams === 0 && fils === 0) return 'Zero Dirhams Only';
    const billion = Math.floor(dirhams / 1_000_000_000);
    const million = Math.floor((dirhams % 1_000_000_000) / 1_000_000);
    const thousand = Math.floor((dirhams % 1_000_000) / 1000);
    const rest = dirhams % 1000;
    const chunks = [];
    if (billion) chunks.push(`${groupWords(billion)} Billion`);
    if (million) chunks.push(`${groupWords(million)} Million`);
    if (thousand) chunks.push(`${groupWords(thousand)} Thousand`);
    if (rest) chunks.push(groupWords(rest));
    const dirhamPart = dirhams === 0 ? 'Zero Dirhams' : `${chunks.join(' ')} Dirham${dirhams === 1 ? '' : 's'}`;
    if (!fils) return `${dirhamPart} Only`;
    const filsWords =
        fils < 20 && fils >= 10
            ? TEENS[fils - 10]
            : fils < 10
                ? ONES[fils]
                : `${TENS[Math.floor(fils / 10)]}${fils % 10 ? `-${ONES[fils % 10]}` : ''}`;
    return `${dirhamPart} and ${filsWords} Fils Only`;
}

function deductionMatches(component, name) {
    const a = String(component || '').trim().toLowerCase();
    const b = String(name || '').trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if ((a === 'late out' || a === 'early out') && (b === 'late out' || b === 'early out')) return true;
    if (b === 'fine' && a.startsWith('fine')) return true;
    if (b === 'utility excess' && a.includes('utility')) return true;
    if (b === 'sick leave' && (a === 'sick' || a.startsWith('sick'))) return true;
    if (b === 'phone allowance' && a.includes('phone')) return true;
    return false;
}

function manualOtherDeductionOf(slip) {
    const raw = slip?.manualOtherDeduction || {};
    const description = String(raw.description || '').replace(/[\u0000-\u001F]/g, '').slice(0, 120);
    return { description, amount: Math.max(0, money(raw.amount)) };
}

function applyManualOtherDeduction(rows, manual) {
    const list = (Array.isArray(rows) ? rows : [])
        .map((row) => ({ ...row }))
        .filter((row) => !deductionMatches(row.component, 'Other deduction'));
    const line = {
        component: 'Other deduction',
        basis: String(manual.description || '').trim(),
        amount: manual.amount,
    };
    const utilityIndex = list.findIndex((row) => deductionMatches(row.component, 'Utility Excess'));
    if (utilityIndex >= 0) list.splice(utilityIndex + 1, 0, line);
    else list.push(line);
    return list;
}

function setDeductionAmount(rows, name, amount) {
    const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
    const idx = list.findIndex((row) => deductionMatches(row.component, name));
    if (idx >= 0) {
        list[idx] = { ...list[idx], amount: money(amount) };
        return list;
    }
    return list;
}

function deductionLineOverridden(overrides, name) {
    if (!overrides || !name) return false;
    if (overrides[name]) return true;
    const key = String(name || '').trim().toLowerCase();
    if (key && overrides[key]) return true;
    return Object.keys(overrides).some((flag) => {
        if (!overrides[flag]) return false;
        return flag === name || deductionMatches(name, flag) || deductionMatches(flag, name);
    });
}

function pushDetailsIntoDeductions(slip) {
    let deductions = Array.isArray(slip.deductions) ? slip.deductions.map((row) => ({ ...row })) : [];
    const overrides = slip?.thisMonthOverrides || {};
    for (const row of slip.attendanceDeductions || []) {
        if (deductionLineOverridden(overrides, row.category)) continue;
        deductions = setDeductionAmount(deductions, row.category, row.total);
    }
    const loans = Array.isArray(slip.loanSchedule) ? slip.loanSchedule : [];
    if (loans.length) {
        const monthTotal = (rows, predicate) =>
            money(
                rows.reduce((sum, row) => {
                    if (predicate && !predicate(row)) return sum;
                    return sum + money(row?.thisMonthAmount ?? row?.thisMonth);
                }, 0),
            );
        deductions = setDeductionAmount(
            deductions,
            'Salary Advance',
            monthTotal(loans, (row) => /advance/i.test(String(row?.type || ''))),
        );
        deductions = setDeductionAmount(
            deductions,
            'Loan',
            monthTotal(loans, (row) => !/advance/i.test(String(row?.type || ''))),
        );
    }
    const fineTotal = (slip.fines || []).reduce(
        (sum, row) => sum + money(row.thisMonthAmount ?? row.thisMonth),
        0,
    );
    if (fineTotal > 0 || (slip.fines || []).length) {
        deductions = setDeductionAmount(deductions, 'Fine', fineTotal);
    }
    const utilTotal = (slip.utilities || []).reduce(
        (sum, row) => sum + money(row.thisMonthAmount ?? row.thisMonth),
        0,
    );
    deductions = setDeductionAmount(deductions, 'Utility Excess', utilTotal);
    deductions = applyManualOtherDeduction(deductions, manualOtherDeductionOf(slip));
    return { ...slip, deductions };
}

export function recalcSlip(slip) {
    if (!slip) return slip;
    const earnings = (slip.earnings || []).map((row) => ({ ...row, amount: money(row.amount) }));
    const yearlyEarnings = (slip.yearlyEarnings || []).map((row) => ({
        ...row,
        amount: money(row.amount),
    }));
    const manualOtherDeduction = manualOtherDeductionOf(slip);
    const deductions = applyManualOtherDeduction(
        (slip.deductions || []).map((row) => ({ ...row, amount: money(row.amount) })),
        manualOtherDeduction,
    );
    const grossEarnings = money(earnings.reduce((sum, row) => sum + money(row.amount), 0));
    const yearlyGrossEarnings = money(yearlyEarnings.reduce((sum, row) => sum + money(row.amount), 0));
    const totalDeductions = money(deductions.reduce((sum, row) => sum + money(row.amount), 0));
    const netSalary = money(Math.max(0, grossEarnings - totalDeductions));
    const attendanceDeductions = (slip.attendanceDeductions || []).map((row) => ({
        ...row,
        total: money(row.total),
    }));
    const attendanceDeductionTotal = money(
        attendanceDeductions.reduce((sum, row) => sum + money(row.total), 0),
    );
    const loanSchedule = (slip.loanSchedule || []).map((row) => {
        const thisMonthAmount = money(row.thisMonthAmount ?? row.thisMonth);
        return { ...row, thisMonthAmount, thisMonth: formatAed(thisMonthAmount) };
    });
    const fines = (slip.fines || []).map((row) => {
        const thisMonthAmount = money(row.thisMonthAmount ?? row.thisMonth);
        return { ...row, thisMonthAmount, thisMonth: formatAed(thisMonthAmount) };
    });
    const utilities = (slip.utilities || []).map((row) => {
        const total = money(row.total ?? row.amount);
        return { ...row, total, amount: formatAed(total) };
    });
    const salaryAdvance = money(
        loanSchedule
            .filter((row) => /advance/i.test(String(row.type || '')))
            .reduce((sum, row) => sum + money(row.thisMonthAmount), 0),
    );
    const loan = money(
        loanSchedule
            .filter((row) => !/advance/i.test(String(row.type || '')))
            .reduce((sum, row) => sum + money(row.thisMonthAmount), 0),
    );
    const fine = money(fines.reduce((sum, row) => sum + money(row.thisMonthAmount), 0));
    const utilityExcess = money(
        utilities.reduce((sum, row) => sum + money(row.thisMonthAmount ?? row.thisMonth), 0),
    );
    return {
        ...slip,
        earnings,
        yearlyEarnings,
        yearlyGrossEarnings,
        manualOtherDeduction,
        deductions,
        attendanceDeductions,
        attendanceDeductionTotal,
        loanSchedule,
        fines,
        utilities,
        grossEarnings,
        totalDeductions,
        netSalary,
        amountInWords: amountInWordsAed(netSalary),
        reconciliation: {
            attendance: attendanceDeductionTotal,
            salaryAdvance,
            loan,
            fine,
            utilityExcess,
            otherDeduction: manualOtherDeduction.amount,
            verifiedTotal: totalDeductions,
        },
    };
}

function markChangedSlipAmounts(beforeRows, afterRows, overrides) {
    const beforeBy = new Map();
    for (const row of beforeRows || []) {
        const name = String(row?.component || row?.type || '').trim();
        if (!name) continue;
        beforeBy.set(name.toLowerCase(), money(row.amount ?? row.total ?? row.thisMonthAmount));
    }
    for (const row of afterRows || []) {
        const name = String(row?.component || row?.type || '').trim();
        if (!name) continue;
        const next = money(row.amount ?? row.total ?? row.thisMonthAmount);
        if (beforeBy.get(name.toLowerCase()) !== next) overrides[name] = true;
    }
    return overrides;
}

export function applySlipSectionPatch(slip, section, updater) {
    const draft = updater(JSON.parse(JSON.stringify(slip || {})));
    const overrides = { ...(draft.thisMonthOverrides || {}) };
    markChangedSlipAmounts(slip?.earnings, draft.earnings, overrides);
    markChangedSlipAmounts(slip?.yearlyEarnings, draft.yearlyEarnings, overrides);
    markChangedSlipAmounts(slip?.deductions, draft.deductions, overrides);
    draft.thisMonthOverrides = overrides;
    const fromDetails = new Set([
        'attendanceDeductions',
        'loans',
        'fines',
        'utilities',
        'thisMonthDeduction',
        'manualOtherDeduction',
    ]);
    if (section === 'fines') {
        draft.thisMonthOverrides = { ...(draft.thisMonthOverrides || {}), Fine: true };
    } else if (section === 'loans') {
        draft.thisMonthOverrides = { ...(draft.thisMonthOverrides || {}), Loan: true, 'Salary Advance': true };
    } else if (section === 'utilities') {
        draft.thisMonthOverrides = { ...(draft.thisMonthOverrides || {}), Utility: true };
    }
    const synced = fromDetails.has(section) ? pushDetailsIntoDeductions(draft) : draft;
    return recalcSlip(synced);
}

export function salarySlipMonthHref(employeeId, monthKey) {
    return `/HRM/Salary/enroll/${encodeURIComponent(employeeId)}/salary-slip/${encodeURIComponent(monthKey)}`;
}

export function salarySlipMonthLabel(monthKey) {
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return String(monthKey || '');
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    if (Number.isNaN(date.getTime())) return String(monthKey);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export async function salarySlipErrorMessage(err) {
    const data = err?.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            if (parsed?.message) return parsed.message;
        } catch {
            /* keep default */
        }
    }
    if (typeof data?.message === 'string' && data.message) return data.message;
    return 'Could not load salary slip for this month.';
}

export function summarizeSlipRow(slip) {
    const extra = money(
        (slip?.earnings || []).reduce((sum, row) => {
            if (!EXTRA_EARNING.test(String(row?.component || ''))) return sum;
            return sum + money(row?.amount);
        }, 0),
    );
    const gross = money(slip?.grossEarnings);
    return {
        salary: money(gross - extra),
        extra,
        deduction: money(slip?.totalDeductions),
        totalSalary: money(slip?.netSalary),
        type: /wps/i.test(String(slip?.paymentMethod || '')) ? 'WPS' : 'Cash',
    };
}
