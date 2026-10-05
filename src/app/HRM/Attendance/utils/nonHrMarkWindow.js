function shiftDateKey(dateKey, deltaDays) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Today plus two earlier days. Holiday dates are skipped and do not count. */
export function nonHrMarkableDateKeys(todayKey, holidayDates, extraDays = 2) {
    const today = String(todayKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return new Set();

    const holidays = new Set(
        (Array.isArray(holidayDates) ? holidayDates : [])
            .map((date) => String(date || '').trim())
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
    );
    const allowed = new Set([today]);
    let cursor = today;
    let picked = 0;
    let guard = 0;
    while (picked < extraDays && guard < 90) {
        guard += 1;
        cursor = shiftDateKey(cursor, -1);
        if (holidays.has(cursor)) continue;
        allowed.add(cursor);
        picked += 1;
    }
    return allowed;
}
