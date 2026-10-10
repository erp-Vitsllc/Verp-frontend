function clockMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/** Checkout landed on a later calendar day, or the clock wrapped past midnight. */
export function isNextDayCheckout({ date, timeIn, timeOut, timeOutDate } = {}) {
    const out = String(timeOut || '').trim();
    if (!out || out === '—' || out === 'OT') return false;
    const day = String(date || '').trim();
    const outDate = String(timeOutDate || '').trim();
    if (outDate && day) return outDate > day;
    const start = clockMinutes(timeIn);
    const end = clockMinutes(timeOut);
    if (start == null || end == null) return false;
    return end < start;
}
