let monthKey = '';
const listeners = new Set();

export function getAttendanceCalendarMonth() {
    return monthKey;
}

export function setAttendanceCalendarMonth(next) {
    const value = /^\d{4}-\d{2}$/.test(String(next || '')) ? String(next) : '';
    if (value === monthKey) return;
    monthKey = value;
    listeners.forEach((listener) => listener(monthKey));
}

export function subscribeAttendanceCalendarMonth(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
