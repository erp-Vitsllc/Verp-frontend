/**
 * UAE public holiday catalog (expected Gregorian dates).
 * Islamic dates are approximate and subject to moon sighting.
 */

function pad2(n) {
    return String(n).padStart(2, '0');
}

function d(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** @returns {{ date: string, name: string, month: number }[]} */
export function getUaeHolidaysForYear(year) {
    const y = Number(year);
    if (!Number.isFinite(y)) return [];

    /** Fixed + forecast lists by year. Extend as official dates are announced. */
    const byYear = {
        2025: [
            { date: d(2025, 1, 1), name: "New Year's Day" },
            { date: d(2025, 3, 30), name: 'Eid Al Fitr' },
            { date: d(2025, 3, 31), name: 'Eid Al Fitr Holiday' },
            { date: d(2025, 4, 1), name: 'Eid Al Fitr Holiday' },
            { date: d(2025, 6, 5), name: 'Arafat Day' },
            { date: d(2025, 6, 6), name: 'Eid Al Adha' },
            { date: d(2025, 6, 7), name: 'Eid Al Adha Holiday' },
            { date: d(2025, 6, 8), name: 'Eid Al Adha Holiday' },
            { date: d(2025, 6, 26), name: 'Islamic New Year' },
            { date: d(2025, 9, 4), name: "Prophet Muhammad's Birthday" },
            { date: d(2025, 12, 1), name: 'Commemoration Day' },
            { date: d(2025, 12, 2), name: 'UAE National Day' },
            { date: d(2025, 12, 3), name: 'UAE National Day Holiday' },
        ],
        2026: [
            { date: d(2026, 1, 1), name: "New Year's Day" },
            { date: d(2026, 3, 19), name: 'Eid Al Fitr Holiday' },
            { date: d(2026, 3, 20), name: 'Eid Al Fitr' },
            { date: d(2026, 3, 21), name: 'Eid Al Fitr Holiday' },
            { date: d(2026, 3, 22), name: 'Eid Al Fitr Holiday' },
            { date: d(2026, 5, 26), name: 'Arafat Day' },
            { date: d(2026, 5, 27), name: 'Eid Al Adha' },
            { date: d(2026, 5, 28), name: 'Eid Al Adha Holiday' },
            { date: d(2026, 5, 29), name: 'Eid Al Adha Holiday' },
            { date: d(2026, 6, 16), name: 'Islamic New Year' },
            { date: d(2026, 8, 25), name: "Prophet Muhammad's Birthday" },
            { date: d(2026, 12, 1), name: 'Commemoration Day' },
            { date: d(2026, 12, 2), name: 'UAE National Day' },
            { date: d(2026, 12, 3), name: 'UAE National Day Holiday' },
        ],
        2027: [
            { date: d(2027, 1, 1), name: "New Year's Day" },
            { date: d(2027, 3, 9), name: 'Eid Al Fitr' },
            { date: d(2027, 3, 10), name: 'Eid Al Fitr Holiday' },
            { date: d(2027, 3, 11), name: 'Eid Al Fitr Holiday' },
            { date: d(2027, 5, 15), name: 'Arafat Day' },
            { date: d(2027, 5, 16), name: 'Eid Al Adha' },
            { date: d(2027, 5, 17), name: 'Eid Al Adha Holiday' },
            { date: d(2027, 5, 18), name: 'Eid Al Adha Holiday' },
            { date: d(2027, 6, 6), name: 'Islamic New Year' },
            { date: d(2027, 8, 14), name: "Prophet Muhammad's Birthday" },
            { date: d(2027, 12, 1), name: 'Commemoration Day' },
            { date: d(2027, 12, 2), name: 'UAE National Day' },
            { date: d(2027, 12, 3), name: 'UAE National Day Holiday' },
        ],
    };

    const list = byYear[y] || [
        { date: d(y, 1, 1), name: "New Year's Day" },
        { date: d(y, 12, 1), name: 'Commemoration Day' },
        { date: d(y, 12, 2), name: 'UAE National Day' },
        { date: d(y, 12, 3), name: 'UAE National Day Holiday' },
    ];

    return list.map((h) => ({
        ...h,
        month: Number(h.date.slice(5, 7)),
        year: y,
    }));
}

/**
 * UAE holidays from the 1st of the current month through 31 Dec this year,
 * plus every holiday in the following year.
 */
export function getUaeHolidaysCurrentMonthThroughNextYear(now = new Date()) {
    const thisYear = now.getFullYear();
    const nextYear = thisYear + 1;
    const fromMonth = now.getMonth() + 1;

    const thisYearHolidays = getUaeHolidaysForYear(thisYear).filter(
        (h) => h.month >= fromMonth,
    );
    const nextYearHolidays = getUaeHolidaysForYear(nextYear);

    return {
        thisYear,
        nextYear,
        fromMonth,
        holidays: [...thisYearHolidays, ...nextYearHolidays],
    };
}

export const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
