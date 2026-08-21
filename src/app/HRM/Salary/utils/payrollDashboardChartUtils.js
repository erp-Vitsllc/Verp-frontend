/** Shared payroll dashboard colors, formatters, and empty chart fallbacks. */

export const PAYROLL_COLORS = {
    blue: '#0877EF',
    teal: '#16B8A5',
    orange: '#F5A000',
    coral: '#FF4949',
    slate: '#778292',
    grid: '#ECEEF2',
    axis: '#4D535D',
    title: '#111318',
    muted: '#8B9099',
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
        Sick: '#FF4949',
        Authorized: '#19B8A7',
        Unauthorized: '#FFA30B',
    };
    return rows.map((row) => ({ ...row, color: colors[row.name] || PAYROLL_COLORS.slate }));
}

export function withDeductionColors(rows = []) {
    const colors = {
        'Loss of Pay': '#FF4949',
        Loan: '#18B7A7',
        Advance: '#FFA20B',
        Fine: '#778292',
    };
    return rows.map((row) => ({ ...row, color: colors[row.name] || PAYROLL_COLORS.slate }));
}
