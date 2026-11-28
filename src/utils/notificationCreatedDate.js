function asDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function sameCalendarDay(left, right) {
    if (!left || !right) return false;
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    );
}

function firstDate(values) {
    for (const value of values) {
        const date = asDate(value);
        if (date) return date;
    }
    return null;
}

function expiryDateFromExtra(extra1 = '') {
    const match = String(extra1 || '').match(/\(Exp:\s*([^)]+)\)/i);
    const raw = match?.[1] ? String(match[1]).trim() : '';
    if (!raw) return null;
    const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3]);
        const date = new Date(year, month - 1, day);
        if (!Number.isNaN(date.getTime())) return date;
    }
    return asDate(raw);
}

/**
 * When the notification or task was created.
 * A requested date that is only the document expiry is not the created date.
 */
export function notificationCreatedAt(item) {
    const raw = item?.raw && typeof item.raw === 'object' ? item.raw : item;
    const created = firstDate([item?.createdAt, raw?.createdAt]);
    if (created) return created;
    const requested = firstDate([
        item?.requestedDate,
        raw?.requestedDate,
        raw?.requestedAt,
        raw?.leaveRequestedAt,
    ]);
    const expiry = expiryDateFromExtra(raw?.extra1 || item?.extra1);
    if (requested && expiry && sameCalendarDay(requested, expiry)) return null;
    return requested;
}
