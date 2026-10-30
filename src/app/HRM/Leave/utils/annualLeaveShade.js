function dateKeyToLocalDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
}

function dateToKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const LEAVE_MONTHS = [
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

export function formatLeaveDate(value) {
    const date = dateKeyToLocalDate(value);
    if (!date) return value || '';
    return `${date.getDate()} ${LEAVE_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function addDaysKey(key, days) {
    const date = dateKeyToLocalDate(key);
    if (!date) return '';
    date.setDate(date.getDate() + (Number(days) || 0));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function nextOpenFrom(spans, key) {
    const sorted = (spans || [])
        .filter((span) => span?.from && span?.to && span.to >= key)
        .sort((left, right) => (left.from < right.from ? -1 : 1));
    const upcoming = sorted.find((span) => span.from > key);
    return (upcoming || sorted[0])?.from || '';
}

export function describeAnnualLeaveRange({ calendar, from, to, processingStart = '' }) {
    if (!calendar || !from || !to || to < from) return '';
    const spans = calendar.openSpans || [];
    const own = new Set(calendar.ownLeaveDates || []);
    const capped = new Set(calendar.cappedDates || []);
    const minimumDays = Number(calendar.minimumDays) || 5;
    const remainingDays = Math.max(0, Number(calendar.remainingDays) || 0);
    let cursor = from;
    let steps = 0;
    while (cursor && cursor <= to && steps < 400) {
        if (processingStart && cursor < processingStart) {
            return `Leave cannot start before this employee's salary processing date (${formatLeaveDate(processingStart)}).`;
        }
        const open = spans.some((span) => cursor >= span.from && cursor <= span.to);
        if (!open) {
            const openOn = nextOpenFrom(spans, cursor);
            if (!openOn && remainingDays > 0 && remainingDays < minimumDays) {
                const dayWord = remainingDays === 1 ? 'day' : 'days';
                return `You have ${remainingDays} ${dayWord} of annual leave left. You need at least ${minimumDays} days remaining to apply.`;
            }
            if (openOn) {
                return `${formatLeaveDate(cursor)} is closed. Choose a date on or after ${formatLeaveDate(openOn)}.`;
            }
            return `${formatLeaveDate(cursor)} is closed for annual leave.`;
        }
        if (own.has(cursor)) {
            return `You already have leave on ${formatLeaveDate(cursor)}. Choose another day.`;
        }
        if (capped.has(cursor)) {
            const max = calendar.maxAllowed;
            const group = calendar.groupLabel || 'this group';
            const pct = calendar.maxPercent;
            const limit =
                max == null
                    ? ''
                    : ` Only ${max} ${max === 1 ? 'employee' : 'employees'}${pct == null ? '' : ` (${pct}%)`} in ${group} can be on annual leave that day.`;
            return `${formatLeaveDate(cursor)} is already at the group limit.${limit}`;
        }
        cursor = addDaysKey(cursor, 1);
        steps += 1;
    }
    return '';
}

/** Grey closed days, green open days, yellow days within 2 days of leave. */
export function buildAnnualLeaveShade(calendar, { processingStart = '', allowEarly = false } = {}) {
    if (!calendar) return null;
    const capped = new Set(calendar.cappedDates || []);
    const own = new Set(calendar.ownLeaveDates || []);
    const toneOfKey = (key) => {
        if (!key) return '';
        if (!allowEarly && processingStart && key < processingStart) return 'grey';
        const open = (calendar.openSpans || []).some((span) => key >= span.from && key <= span.to);
        if (!open) return 'grey';
        if (own.has(key) || capped.has(key)) return 'yellow';
        if ((calendar.yellowSpans || []).some((span) => key >= span.from && key <= span.to)) return 'yellow';
        return 'green';
    };
    return {
        modifiers: {
            leaveGrey: (date) => toneOfKey(dateToKey(date)) === 'grey',
            leaveGreen: (date) => toneOfKey(dateToKey(date)) === 'green',
            leaveYellow: (date) => toneOfKey(dateToKey(date)) === 'yellow',
        },
        modifiersStyles: {
            leaveGrey: { backgroundColor: '#e5e7eb' },
            leaveGreen: { backgroundColor: '#dcfce7' },
            leaveYellow: { backgroundColor: '#fef9c3' },
        },
        calendarClassNames: { disabled: 'cursor-not-allowed opacity-100' },
        disableDate: allowEarly
            ? null
            : (date) => {
                  const key = dateToKey(date);
                  const tone = toneOfKey(key);
                  return tone === 'grey' || capped.has(key) || own.has(key);
              },
    };
}
