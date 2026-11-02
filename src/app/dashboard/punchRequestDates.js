const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function weekdayKeyFromDateKey(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    return WEEKDAY_KEYS[new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()] || null;
}

/**
 * Late arrival, early go, and mispunch dates follow the attendance calendar month.
 * Other date lists stay on the current month.
 */
export function requestDateOptions({
    attendanceRecords = [],
    todayKey = '',
    calendarMonth = '',
    variant = '',
    holidayDates = null,
    offWeekdays = null,
} = {}) {
    const currentMonth = String(todayKey || '').slice(0, 7);
    const followsCalendar = variant === 'late' || variant === 'early' || variant === 'mispunch';
    const listMonth = followsCalendar && /^\d{4}-\d{2}$/.test(String(calendarMonth || ''))
        ? String(calendarMonth)
        : currentMonth;
    const isMispunch = variant === 'mispunch';
    const isPreviousDate = variant === 'previous';
    const isSickLeave = variant === 'sick';
    const rows = (Array.isArray(attendanceRecords) ? attendanceRecords : [])
        .filter((row) => {
            const date = String(row?.date || '').slice(0, 10);
            if (!date.startsWith(listMonth) || date > todayKey) return false;
            const status = String(row?.statusKey || '');
            if (isPreviousDate) {
                if (date >= todayKey) return false;
                if (status !== 'unauthorized_leave') return false;
                return !/mispunch/i.test(String(row?.reason || ''));
            }
            const approved = ['approvalStatus', 'leaveRequestStatus', 'hourAdjustStatus']
                .some((key) => String(row?.[key] || '').toLowerCase() === 'approved');
            const pending = String(row?.leaveRequestStatus || '').toLowerCase() === 'pending';
            if (approved || pending) return false;
            if (isSickLeave || isMispunch) {
                const noPunch = !String(row?.timeIn || '').trim() && !String(row?.timeOut || '').trim();
                const unauth =
                    !status ||
                    status === 'unauthorized_leave' ||
                    status === 'not_marked' ||
                    status === 'absent';
                if (isSickLeave) return unauth && noPunch && date < todayKey && status !== 'mispunch';
                return (
                    status === 'mispunch' ||
                    /mispunch/i.test(String(row?.reason || '')) ||
                    (unauth && noPunch && date < todayKey)
                );
            }
            if (variant === 'late') return status === 'late_arrived';
            if (variant === 'early') return status === 'early_go';
            return status === 'unauthorized_leave';
        })
        .map((row) => String(row.date).slice(0, 10));
    if (isMispunch || isSickLeave) {
        const known = new Set(
            (Array.isArray(attendanceRecords) ? attendanceRecords : []).map((row) => String(row?.date || '').slice(0, 10)),
        );
        const [year, month] = listMonth.split('-').map(Number);
        const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
        for (let day = 1; day <= last; day += 1) {
            const key = `${listMonth}-${String(day).padStart(2, '0')}`;
            if (key >= todayKey || known.has(key)) continue;
            const weekday = weekdayKeyFromDateKey(key);
            if (holidayDates instanceof Set && holidayDates.has(key)) continue;
            if (offWeekdays instanceof Set && offWeekdays.has(weekday)) continue;
            rows.push(key);
        }
    }
    return {
        dates: [...new Set(rows)].sort(),
        listMonth,
    };
}

export function monthListLabel(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return '';
    const [year, month] = String(monthKey).split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month - 1, 1)));
}
