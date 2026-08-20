/** Shared payroll dashboard colors, formatters, and empty chart fallbacks. */

export const PAYROLL_COLORS = {
    blue: '#1D5FDB',
    teal: '#0B8A80',
    orange: '#C98A0A',
    coral: '#D13E38',
    slate: '#4F6B82',
    grid: '#EEF2F6',
    axis: '#94A3B8',
    title: '#1E293B',
    muted: '#94A3B8',
};

export const PAYROLL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const EMPTY_PAYROLL_SUMMARY = {
    annualPayroll: 'AED 0',
    officeStaff: 'AED 0',
    siteStaff: 'AED 0',
    overtimePaid: 'AED 0',
    annualPayrollShort: 'AED 0',
    officePct: 0,
    sitePct: 0,
};

export function emptyMonthSeries(valueKey) {
    return PAYROLL_MONTHS.map((month) => ({ month, [valueKey]: 0 }));
}

export function emptyOfficeVsSiteMonthly() {
    return PAYROLL_MONTHS.map((month) => ({ month, office: 0, site: 0 }));
}

export function formatK(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 10 || Number.isInteger(n)) return `${Math.round(n)}K`;
    return `${n.toFixed(1)}K`;
}

export function niceAxis(values, tickCount = 4, fallbackMax = 10) {
    const numeric = (Array.isArray(values) ? values : [])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0);
    const maxVal = numeric.length ? Math.max(...numeric) : 0;

    if (maxVal <= 0) {
        const step = fallbackMax / tickCount;
        const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Number((step * i).toFixed(2)));
        return { domain: [0, fallbackMax], ticks };
    }

    const padded = maxVal * 1.2;
    const magnitude = 10 ** Math.floor(Math.log10(padded));
    const rawStep = padded / tickCount;
    const multipliers = [1, 2, 2.5, 5, 10];
    let step = magnitude * 10;
    for (const m of multipliers) {
        if (magnitude * m >= rawStep * 0.85) {
            step = magnitude * m;
            break;
        }
    }

    const niceMax = Math.ceil(padded / step) * step;
    const ticks = [];
    for (let v = 0; v <= niceMax + step / 4; v += step) {
        ticks.push(Number(v.toFixed(4)));
    }
    return { domain: [0, ticks[ticks.length - 1]], ticks };
}

export function withLeaveColors(rows = []) {
    const colors = {
        Sick: PAYROLL_COLORS.coral,
        Authorized: PAYROLL_COLORS.teal,
        Unauthorized: PAYROLL_COLORS.orange,
    };
    return rows.map((row) => ({ ...row, color: colors[row.name] || PAYROLL_COLORS.slate }));
}

export function withDeductionColors(rows = []) {
    const colors = {
        'Loss of Pay': PAYROLL_COLORS.coral,
        Loan: PAYROLL_COLORS.teal,
        Advance: PAYROLL_COLORS.orange,
        Fine: PAYROLL_COLORS.slate,
    };
    return rows.map((row) => ({ ...row, color: colors[row.name] || PAYROLL_COLORS.slate }));
}
