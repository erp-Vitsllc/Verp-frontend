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
            leaveGrey: { backgroundColor: 'transparent' },
            leaveGreen: { backgroundColor: 'transparent' },
            leaveYellow: { backgroundColor: 'transparent' },
        },
        calendarClassNames: {
            disabled: 'cursor-not-allowed opacity-100',
            root: 'rdp-root w-[236px]',
            month: 'rdp-month flex w-full flex-col gap-1',
            week: 'rdp-week mt-0.5 flex w-full',
            weekday: 'rdp-weekday flex-1 select-none text-center text-[0.65rem] font-normal text-muted-foreground',
        },
        disableDate: allowEarly
            ? null
            : (date) => {
                  const key = dateToKey(date);
                  const tone = toneOfKey(key);
                  return tone === 'grey' || capped.has(key) || own.has(key);
              },
    };
}

const NEARBY_LEAVE_DAYS = 2;

function isDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function dubaiTodayKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function rangesOverlap(from, to, otherFrom, otherTo) {
    return from <= otherTo && to >= otherFrom;
}

function nextOpenDate(calendar, allowance, todayKey) {
    const spanFrom = String(calendar?.eligibleOn || calendar?.openSpans?.[0]?.from || '');
    if (isDateKey(spanFrom) && spanFrom > todayKey) return spanFrom;
    const dates = (allowance?.windows || [])
        .map((row) => String(row?.eligibleOn || ''))
        .filter((date) => isDateKey(date) && date > todayKey)
        .sort();
    return dates[0] || '';
}

function balanceIsShort(allowance, calendar) {
    if ((calendar?.openSpans || []).length > 0) return false;
    const minimum = Math.max(1, Number(calendar?.minimumDays) || 5);
    const allowed = Number(allowance?.allowedDays || calendar?.allowedDays) || 30;
    const windows = allowance?.windows || [];
    const active = windows.filter((row) => row.status === 'Active');
    if (active.length) {
        return Math.max(...active.map((row) => Number(row.remainingDays) || 0)) < minimum;
    }
    const upcoming = windows.find((row) => row.status === 'Inactive');
    if (upcoming) {
        return Math.max(0, allowed - (Number(upcoming.takenDays) || 0)) < minimum;
    }
    const left = Number(calendar?.remainingDays) || 0;
    return left > 0 && left < minimum;
}

function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function coworkerLeaveNames({ otherLeaves = [], from = '', to = '' } = {}) {
    const start = String(from || to || '');
    const end = String(to || from || '');
    if (!isDateKey(start) || !isDateKey(end) || end < start) return [];
    const names = [];
    for (const person of otherLeaves || []) {
        const hit = (person?.dates || []).some((date) => {
            if (!isDateKey(date)) return false;
            return rangesOverlap(start, end, addDaysKey(date, -NEARBY_LEAVE_DAYS), addDaysKey(date, NEARBY_LEAVE_DAYS));
        });
        const name = String(person?.name || '').trim();
        if (hit && name && !names.includes(name)) names.push(name);
    }
    return names;
}

/** Same-size validation lines. Yellow is information. Red blocks the request. */
export function buildAnnualLeaveValidationLines({
    calendar,
    allowance,
    otherLeaves = [],
    from = '',
    to = '',
    today = '',
} = {}) {
    if (!calendar) return [];
    const todayKey = isDateKey(today) ? today : dubaiTodayKey();
    const lines = [];
    const openOn = nextOpenDate(calendar, allowance, todayKey);
    const short = balanceIsShort(allowance, calendar);
    if (openOn) {
        lines.push({
            tone: 'yellow',
            code: 'opens',
            text: `Annual leave opens on ${formatLeaveDate(openOn)}. Days before that stay closed.`,
        });
    } else if (!(calendar.openSpans || []).length && !short) {
        lines.push({
            tone: 'yellow',
            code: 'opens',
            text: 'Annual leave is not open yet. Days before it opens stay closed.',
        });
    }
    if (short) {
        const minimum = Math.max(1, Number(calendar.minimumDays) || 5);
        lines.push({
            tone: 'red',
            code: 'minimum',
            text: `You need at least ${minimum} days remaining to apply.`,
        });
    }
    const names = coworkerLeaveNames({ otherLeaves, from, to });
    if (names.length) {
        lines.push({
            tone: 'red',
            code: 'coworker',
            text: `You can't go because ${joinNames(names)} already took leave on that.`,
        });
    }
    if (lines.length) {
        lines.push({
            tone: 'yellow',
            code: 'contact',
            text: 'For more info, contact HR.',
        });
    }
    return lines;
}
