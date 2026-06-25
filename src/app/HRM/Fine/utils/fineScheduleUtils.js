/** Approved fines only — employee financials exclude pending/draft/rejected. */
export const APPROVED_FINE_STATUSES = ['Approved', 'Active', 'Paid', 'Completed'];

/** Pending fines may appear in New Schedule preview only (not Current, not Rejected). */
export function isPendingSchedulePreviewStatus(status) {
    if (!status) return false;
    const normalized = String(status).trim();
    if (normalized === 'Rejected' || normalized === 'Draft') return false;
    if (APPROVED_FINE_STATUSES.includes(normalized)) return false;
    return normalized.toLowerCase().includes('pending');
}

export function isRejectedFineStatus(status) {
    return String(status || '').trim() === 'Rejected';
}

export function isPaidFineStatus(status) {
    const s = String(status || '').trim();
    return s === 'Paid' || s === 'Completed';
}

function scheduleYmFromValue(val) {
    if (!val) return 0;
    if (typeof val === 'string') {
        const parts = val.split(/[-/T ]/);
        if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (y > 1000 && m >= 1 && m <= 12) return y * 100 + m;
        }
    }
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return 0;
    return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function addMonthsYm(ym, months) {
    if (ym <= 0) return 0;
    let y = Math.floor(ym / 100);
    let m = ym % 100;
    m += months;
    while (m > 12) { m -= 12; y += 1; }
    while (m < 1) { m += 12; y -= 1; }
    return y * 100 + m;
}

/** Deduction start/end (MM/YYYY) for a single fine record. */
export function deriveFineScheduleMonthYears(fineData) {
    let startMonthStr = '-';
    let endMonthStr = '-';
    const baseMonthStr = fineData?.monthStart || fineData?.awardedDate;
    if (!baseMonthStr) return { startMonthYear: startMonthStr, endMonthYear: endMonthStr };

    try {
        let date;
        if (typeof baseMonthStr === 'string' && baseMonthStr.includes('-')) {
            const p = baseMonthStr.split('-');
            date = new Date(parseInt(p[0], 10), (parseInt(p[1], 10) || 1) - 1, 1);
        } else {
            date = new Date(baseMonthStr);
        }

        if (!Number.isNaN(date.getTime())) {
            const formatMY = (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            startMonthStr = formatMY(date);
            const duration = parseInt(fineData.payableDuration, 10) || 1;
            const endYM = addMonthsYm(scheduleYmFromValue(baseMonthStr), duration - 1);
            const ey = Math.floor(endYM / 100);
            const em = endYM % 100;
            endMonthStr = `${em.toString().padStart(2, '0')}/${ey}`;
        }
    } catch {
        startMonthStr = String(baseMonthStr);
    }

    return { startMonthYear: startMonthStr, endMonthYear: endMonthStr };
}

/** YYYY-MM deduction months covered by a fine schedule (monthStart + payableDuration). */
export function getFineScheduleMonthYMs(fineData) {
    const baseMonthStr = fineData?.monthStart || fineData?.awardedDate || fineData?.fineDate || fineData?.createdAt;
    const startYM = scheduleYmFromValue(baseMonthStr);
    const duration = Math.max(1, parseInt(fineData?.payableDuration, 10) || 1);
    if (startYM <= 0) return [];
    return Array.from({ length: duration }, (_, i) => addMonthsYm(startYM, i));
}

/** True when any deduction month overlaps [startMonth, endMonth] (YYYY-MM strings). */
export function fineMatchesDeductionMonthRange(fine, startMonth, endMonth) {
    const filterActive = Boolean(startMonth || endMonth);
    if (!filterActive) return true;

    const startYM = startMonth ? scheduleYmFromValue(`${startMonth}-01`) : 0;
    const endYM = endMonth ? scheduleYmFromValue(`${endMonth}-01`) : 0;
    if (startYM > 0 && endYM > 0 && startYM > endYM) return false;

    const scheduleMonths = getFineScheduleMonthYMs(fine);
    if (scheduleMonths.length === 0) return true;

    const rangeStart = startYM || scheduleMonths[0];
    const rangeEnd = endYM || 999912;
    return scheduleMonths.some((ym) => ym >= rangeStart && ym <= rangeEnd);
}
