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
    'Late Arrival',
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
    'Annual Leave',
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

function liabilitySummary(type, rows, readTotal, readPaid, readThisMonth) {
    const list = (Array.isArray(rows) ? rows : []).filter(isApprovedLiability);
    const total = sumMoney(list, readTotal);
    const employeePay = sumMoney(list, readPaid);
    const thisMonthDeduction = sumMoney(list, readThisMonth);
    const pending = money(Math.max(0, total - employeePay));
    const balance = money(Math.max(0, total - employeePay - thisMonthDeduction));
    return {
        type,
        count: list.length,
        label: `${type} (${list.length})`,
        total,
        pending,
        balance,
        thisMonthDeduction,
        remainingAfterDeduction: balance,
    };
}

/**
 * Approved loan, fine, utility and salary advance for this employee.
 * Balance = total − employee pay − this month's salary deduction.
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
    if (b === 'fine' && a.startsWith('fine')) return true;
    if (b === 'utility excess' && a.includes('utility')) return true;
    if (b === 'sick leave' && (a === 'sick' || a.startsWith('sick'))) return true;
    if (b === 'phone allowance' && a.includes('phone')) return true;
    return false;
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

function pushDetailsIntoDeductions(slip) {
    let deductions = Array.isArray(slip.deductions) ? slip.deductions.map((row) => ({ ...row })) : [];
    for (const row of slip.attendanceDeductions || []) {
        deductions = setDeductionAmount(deductions, row.category, row.total);
    }
    for (const loan of slip.loanSchedule || []) {
        deductions = setDeductionAmount(deductions, loan.type, loan.thisMonthAmount ?? loan.thisMonth);
    }
    const fineTotal = (slip.fines || []).reduce(
        (sum, row) => sum + money(row.thisMonthAmount ?? row.thisMonth),
        0,
    );
    if (fineTotal > 0 || (slip.fines || []).length) {
        deductions = setDeductionAmount(deductions, 'Fine', fineTotal);
    }
    const utilTotal = (slip.utilities || []).reduce((sum, row) => sum + money(row.total ?? row.amount), 0);
    deductions = setDeductionAmount(deductions, 'Utility Excess', utilTotal);
    return { ...slip, deductions };
}

export function recalcSlip(slip) {
    if (!slip) return slip;
    const earnings = (slip.earnings || []).map((row) => ({ ...row, amount: money(row.amount) }));
    const yearlyEarnings = (slip.yearlyEarnings || []).map((row) => ({
        ...row,
        amount: money(row.amount),
    }));
    const deductions = (slip.deductions || []).map((row) => ({ ...row, amount: money(row.amount) }));
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
    const utilityExcess = money(utilities.reduce((sum, row) => sum + money(row.total), 0));
    return {
        ...slip,
        earnings,
        yearlyEarnings,
        yearlyGrossEarnings,
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
            verifiedTotal: totalDeductions,
        },
    };
}

export function applySlipSectionPatch(slip, section, updater) {
    const draft = updater(JSON.parse(JSON.stringify(slip || {})));
    const fromDetails = new Set(['attendanceDeductions', 'loans', 'fines', 'utilities']);
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
