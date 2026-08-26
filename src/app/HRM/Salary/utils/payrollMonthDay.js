export const PAYROLL_MONTH_DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1));

/** Stored as "1"–"28". Older full dates (YYYY-MM-DD) map to that calendar day, capped at 28. */
export function toPayrollMonthDay(value) {
    if (value == null || value === '') return '';
    const s = String(value).trim();
    const iso = s.match(/^\d{4}-\d{2}-(\d{2})/);
    const n = iso ? Number(iso[1]) : Number(s);
    if (!Number.isInteger(n) || n < 1) return '';
    return String(Math.min(28, n));
}
