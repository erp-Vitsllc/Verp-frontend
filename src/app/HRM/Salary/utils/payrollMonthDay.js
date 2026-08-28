export const PAYROLL_MONTH_DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1));

function parseMonthDay(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    const iso = s.match(/^\d{4}-\d{2}-(\d{2})/);
    const n = iso ? Number(iso[1]) : Number(s);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
}

/** Stored as "1"–"28". Older full dates (YYYY-MM-DD) map to that calendar day, capped at 28. */
export function toPayrollMonthDay(value) {
    const n = parseMonthDay(value);
    if (n == null) return '';
    return String(Math.min(28, n));
}

/** Attendance cutoff can use any calendar day 1–31. */
export function toCalendarMonthDay(value) {
    const n = parseMonthDay(value);
    if (n == null) return '';
    return String(Math.min(31, n));
}

export function daysInCurrentMonth(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export function currentMonthDayOptions(now = new Date()) {
    return Array.from({ length: daysInCurrentMonth(now) }, (_, i) => String(i + 1));
}

/** Empty or days past this month's last day fall back to that last day. */
export function cutoffDayForCurrentMonth(value, now = new Date()) {
    const last = String(daysInCurrentMonth(now));
    const day = toCalendarMonthDay(value);
    if (!day || Number(day) > Number(last)) return last;
    return day;
}
