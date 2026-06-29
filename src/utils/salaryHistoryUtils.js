import { monthKeyFromDate } from '@/utils/employeeSalaryValidation';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse YYYY-MM-DD (or ISO prefix) as calendar date — avoids timezone shifting the month. */
export function parseCalendarDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return {
            year: value.getFullYear(),
            month: value.getMonth() + 1,
            day: value.getDate(),
        };
    }
    const raw = String(value).trim().slice(0, 10);
    const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parts) return null;
    return {
        year: parseInt(parts[1], 10),
        month: parseInt(parts[2], 10),
        day: parseInt(parts[3], 10),
    };
}

export function calendarDateToLocalDate(parts) {
    if (!parts) return null;
    return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
}

/** Keep the from date exactly as entered in the salary form (local calendar). */
export function normalizeSalaryFromDate(value) {
    const cal = parseCalendarDate(value);
    if (cal) return calendarDateToLocalDate(cal);
    return parseDate(value);
}

/** Last day of the month before the salary period start month. */
export function endOfPreviousMonth(value) {
    const cal = parseCalendarDate(value);
    if (cal) {
        return new Date(cal.year, cal.month - 1, 0, 0, 0, 0, 0);
    }
    const d = parseDate(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), 0, 0, 0, 0, 0);
}

/** Serialize a salary date as YYYY-MM-DD using local calendar parts (no UTC shift). */
export function serializeSalaryCalendarDate(value) {
    const cal = parseCalendarDate(value);
    if (!cal) return null;
    const month = String(cal.month).padStart(2, '0');
    const day = String(cal.day).padStart(2, '0');
    return `${cal.year}-${month}-${day}`;
}

/** First day of the salary period month as YYYY-MM-DD. */
export function serializeSalaryFromDate(value) {
    const start = startOfMonth(value);
    return start ? serializeSalaryCalendarDate(start) : null;
}

/** Last day of the month before the given period start, as YYYY-MM-DD. */
export function serializeSalaryToDate(nextPeriodStart) {
    const end = endOfPreviousMonth(nextPeriodStart);
    return end ? serializeSalaryCalendarDate(end) : null;
}

/** Normalize salary history rows before API save — keeps modal month and closes prior row correctly. */
export function normalizeSalaryHistoryForSave(history = []) {
    return history.map((entry) => ({
        ...entry,
        fromDate: entry?.fromDate ? serializeSalaryFromDate(entry.fromDate) : entry?.fromDate,
        toDate: entry?.toDate ? serializeSalaryCalendarDate(entry.toDate) : entry?.toDate,
    }));
}

/** Month + year label without timezone shifting date-only values (e.g. 2024-12-01). */
export function formatSalaryMonthYear(dateInput) {
    if (!dateInput) return '';

    if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
        return `${MONTH_NAMES[dateInput.getMonth()]} ${dateInput.getFullYear()}`;
    }

    const raw = String(dateInput).trim();
    // ISO datetimes must use local calendar — slicing YYYY-MM-DD from UTC shifts the month.
    if (raw.includes('T')) {
        const d = parseDate(raw);
        if (d) return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }

    const cal = parseCalendarDate(raw);
    if (cal) {
        const idx = cal.month - 1;
        if (idx >= 0 && idx < 12) return `${MONTH_NAMES[idx]} ${cal.year}`;
    }

    const d = parseDate(dateInput);
    if (!d) return '';
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatSalaryHistoryPeriodLabel(entry) {
    const fromLabel = formatSalaryMonthYear(entry?.fromDate);
    const toLabel = entry?.toDate ? formatSalaryMonthYear(entry.toDate) : '';
    if (fromLabel && toLabel) return `${fromLabel} to ${toLabel}`;
    if (entry?.month && String(entry.month).trim()) return String(entry.month).trim();
    return fromLabel || 'Salary';
}

export function startOfMonth(value) {
    const cal = parseCalendarDate(value);
    if (cal) return new Date(cal.year, cal.month - 1, 1, 0, 0, 0, 0);
    const d = parseDate(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function dayBefore(value) {
    const d = parseDate(value);
    if (!d) return null;
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    prev.setHours(0, 0, 0, 0);
    return prev;
}

export function sortSalaryHistoryAsc(history = []) {
    return [...history].sort((a, b) => {
        const ta = parseDate(a?.fromDate)?.getTime() ?? 0;
        const tb = parseDate(b?.fromDate)?.getTime() ?? 0;
        return ta - tb;
    });
}

/** Latest-first order used when persisting employee salary history. */
export function sortSalaryHistoryDesc(history = []) {
    return [...history].sort((a, b) => {
        const ta = parseDate(a?.fromDate)?.getTime() ?? 0;
        const tb = parseDate(b?.fromDate)?.getTime() ?? 0;
        return tb - ta;
    });
}

/** Entry whose period includes the given date (inclusive). */
export function getSalaryEntryCoveringDate(history = [], dateInput) {
    const target = startOfMonth(dateInput);
    if (!target) return null;

    const chron = sortSalaryHistoryAsc(history);
    for (const entry of chron) {
        const from = startOfMonth(entry?.fromDate);
        if (!from || from > target) continue;
        const to = entry?.toDate ? parseDate(entry.toDate) : null;
        if (!to || to >= target) return entry;
    }
    return null;
}

/** Next salary period that starts after the given date. */
export function getNextSalaryEntryAfter(history = [], dateInput) {
    const target = startOfMonth(dateInput);
    if (!target) return null;
    return sortSalaryHistoryAsc(history).find((entry) => {
        const from = startOfMonth(entry?.fromDate);
        return from && from > target;
    }) ?? null;
}

/**
 * Insert a new salary history row at the correct chronological position.
 * Closes the overlapping prior period and caps the new row before the next period.
 */
export function insertSalaryHistoryEntry(history = [], newEntry) {
    const fromDate = normalizeSalaryFromDate(newEntry?.fromDate);
    if (!fromDate) return sortSalaryHistoryDesc(history);

    const chron = sortSalaryHistoryAsc(history);
    const monthKey = monthKeyFromDate(fromDate);
    if (monthKey && chron.some((e) => monthKeyFromDate(e?.fromDate) === monthKey)) {
        return null;
    }

    const fromMonthStart = startOfMonth(fromDate);

    const coveringIdx = chron.findIndex((entry) => {
        const from = startOfMonth(entry?.fromDate);
        if (!from || from > fromMonthStart) return false;
        const to = entry?.toDate ? parseDate(entry.toDate) : null;
        return !to || to >= fromMonthStart;
    });

    if (coveringIdx >= 0) {
        chron[coveringIdx] = {
            ...chron[coveringIdx],
            toDate: serializeSalaryToDate(fromDate),
        };
    }

    const nextEntry = getNextSalaryEntryAfter(chron, fromDate);
    const entryToInsert = {
        ...newEntry,
        fromDate: serializeSalaryFromDate(fromDate),
        toDate: nextEntry ? serializeSalaryToDate(nextEntry.fromDate) : null,
    };

    const insertIdx = chron.findIndex((e) => {
        const from = startOfMonth(e?.fromDate);
        return from && from > fromMonthStart;
    });

    if (insertIdx === -1) {
        chron.push(entryToInsert);
    } else {
        chron.splice(insertIdx, 0, entryToInsert);
    }

    return normalizeSalaryHistoryForSave(sortSalaryHistoryDesc(chron));
}

export function salaryEntryToFormValues(entry) {
    if (!entry) {
        return {
            basic: '',
            houseRentAllowance: '',
            vehicleAllowance: '',
            fuelAllowance: '',
            otherAllowance: '',
            totalSalary: '0.00',
        };
    }
    const vehicleAllowance =
        entry.vehicleAllowance ??
        entry.additionalAllowances?.find((a) => a.type?.toLowerCase().includes('vehicle'))?.amount ??
        0;
    const fuelAllowance =
        entry.fuelAllowance ??
        entry.additionalAllowances?.find((a) => a.type?.toLowerCase().includes('fuel'))?.amount ??
        0;
    const basic = entry.basic != null ? String(entry.basic) : '';
    const houseRentAllowance = entry.houseRentAllowance != null ? String(entry.houseRentAllowance) : '';
    const vehicle = vehicleAllowance != null ? String(vehicleAllowance) : '';
    const fuel = fuelAllowance != null ? String(fuelAllowance) : '';
    const other = entry.otherAllowance != null ? String(entry.otherAllowance) : '';
    const total =
        entry.totalSalary != null
            ? Number(entry.totalSalary).toFixed(2)
            : (
                  (parseFloat(basic) || 0) +
                  (parseFloat(houseRentAllowance) || 0) +
                  (parseFloat(vehicle) || 0) +
                  (parseFloat(fuel) || 0) +
                  (parseFloat(other) || 0)
              ).toFixed(2);

    return {
        basic,
        houseRentAllowance,
        vehicleAllowance: vehicle,
        fuelAllowance: fuel,
        otherAllowance: other,
        totalSalary: total,
    };
}
