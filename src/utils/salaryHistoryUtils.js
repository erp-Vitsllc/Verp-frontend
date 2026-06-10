import { monthKeyFromDate } from '@/utils/employeeSalaryValidation';

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfMonth(value) {
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
    const fromDate = startOfMonth(newEntry?.fromDate);
    if (!fromDate) return sortSalaryHistoryDesc(history);

    const chron = sortSalaryHistoryAsc(history);
    const monthKey = monthKeyFromDate(fromDate);
    if (monthKey && chron.some((e) => monthKeyFromDate(e?.fromDate) === monthKey)) {
        return null;
    }

    const coveringIdx = chron.findIndex((entry) => {
        const from = startOfMonth(entry?.fromDate);
        if (!from || from > fromDate) return false;
        const to = entry?.toDate ? parseDate(entry.toDate) : null;
        return !to || to >= fromDate;
    });

    if (coveringIdx >= 0) {
        const prevEnd = dayBefore(fromDate);
        chron[coveringIdx] = { ...chron[coveringIdx], toDate: prevEnd };
    }

    const nextEntry = getNextSalaryEntryAfter(chron, fromDate);
    const entryToInsert = {
        ...newEntry,
        fromDate,
        toDate: nextEntry ? dayBefore(nextEntry.fromDate) : null,
    };

    const insertIdx = chron.findIndex((e) => {
        const from = startOfMonth(e?.fromDate);
        return from && from > fromDate;
    });

    if (insertIdx === -1) {
        chron.push(entryToInsert);
    } else {
        chron.splice(insertIdx, 0, entryToInsert);
    }

    return sortSalaryHistoryDesc(chron);
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
