const ATTENDANCE_PENDING_KEYS = new Set([
    'hour_adjust',
    'flexible_ot',
    'attendance_change',
    'mispunch',
    'late_arrived',
    'early_go',
    'on_leave',
    'sick_leave',
    'compoff_leave',
    'unauthorized_leave',
    'authorized_leave',
    'annual_leave',
]);

function shiftDateKey(dateKey, days) {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const [year, month, day] = raw.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function isAttendancePendingItem(row) {
    const key = String(row?.appliedKey || '').trim();
    if (key === 'utility' || key === 'fine' || key === 'loan' || key === 'advance') return false;
    if (ATTENDANCE_PENDING_KEYS.has(key)) return true;
    const from = String(row?.fromDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return false;
    return /leave|hour|overtime|\bot\b|attendance|punch|late|early|comp[\s-]?off/i.test(String(row?.title || ''));
}

function pendingRequestKind(label) {
    const text = String(label || '').toLowerCase();
    if (/hour/.test(text)) return 'hour';
    if (/overtime|\bot\b|flexible/.test(text)) return 'ot';
    if (/missed|mispunch|attendance leave/.test(text)) return 'punch';
    if (/late/.test(text)) return 'late';
    if (/early/.test(text)) return 'early';
    if (/sick/.test(text)) return 'sick';
    if (/comp/.test(text)) return 'comp';
    if (/unauthor|absent/.test(text)) return 'unauth';
    if (/annual/.test(text)) return 'annual';
    if (/author/.test(text)) return 'auth';
    if (/leave/.test(text)) return 'leave';
    return `other:${text}`;
}

function recordPendingLabel(record) {
    const kind = String(record?.leaveRequestKind || '').trim();
    const requested = String(record?.requestedStatusKey || '').trim();
    if (kind === 'yellow' || requested === 'mispunch') return 'Missed punch request';
    if (kind === 'future_late' || kind === 'past_late' || requested === 'late_arrived') return 'Late in request';
    if (kind === 'future_early' || requested === 'early_go') return 'Early out request';
    if (kind === 'future_annual' || requested === 'on_leave') return 'Annual leave request';
    if (requested === 'sick_leave') return 'Sick leave request';
    if (requested === 'compoff_leave') return 'Comp off request';
    if (requested === 'unauthorized_leave') return 'Unauthorized leave request';
    if (kind === 'future_leave' || requested === 'authorized_leave') return 'Authorized leave request';
    return 'Leave request';
}

function datesInMonth(from, to, monthKey) {
    const start = String(from || '').slice(0, 10);
    let end = String(to || start).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) end = start;
    const dates = [];
    let cursor = start;
    for (let guard = 0; cursor && cursor <= end && guard < 400; guard += 1) {
        if (!monthKey || cursor.startsWith(monthKey)) dates.push(cursor);
        if (cursor === end) break;
        const next = shiftDateKey(cursor, 1);
        if (!next || next === cursor) break;
        cursor = next;
    }
    return dates;
}

function pushPendingLine(map, date, line) {
    const label = String(line?.label || '').trim();
    if (!label) return;
    const list = map.get(date) || [];
    const kind = pendingRequestKind(label);
    const existing = list.find((item) => pendingRequestKind(item.label) === kind);
    if (existing) {
        if (!existing.pendingWith && line.pendingWith) existing.pendingWith = String(line.pendingWith).trim();
        return;
    }
    list.push({
        label,
        requestedBy: String(line.requestedBy || '').trim() || 'Employee',
        pendingWith: String(line.pendingWith || '').trim(),
    });
    map.set(date, list);
}

/** Days in the visible month that still have an open attendance request. */
export function employeePendingRequests({ records, pending, monthKey, employeeName } = {}) {
    const map = new Map();
    const name = String(employeeName || '').trim() || 'Employee';
    const quietDates = new Set();
    (Array.isArray(pending) ? pending : []).forEach((row) => {
        const dates = datesInMonth(row?.fromDate, row?.toDate, monthKey);
        if (row?.reassigned || row?.ownRequest === false) {
            if (row?.reassigned) dates.forEach((date) => quietDates.add(date));
            return;
        }
        if (!isAttendancePendingItem(row)) return;
        const line = {
            label: String(row?.title || 'Request').trim() || 'Request',
            requestedBy: name,
            pendingWith: String(row?.owner || '').trim(),
        };
        dates.forEach((date) => pushPendingLine(map, date, line));
    });
    (Array.isArray(records) ? records : []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (monthKey && !date.startsWith(monthKey))) return;
        if (quietDates.has(date)) return;
        if (String(row.leaveRequestStatus || '') === 'pending') {
            pushPendingLine(map, date, { label: recordPendingLabel(row), requestedBy: name, pendingWith: '' });
        }
        if (String(row.hourAdjustStatus || '') === 'pending') {
            pushPendingLine(map, date, { label: 'Hour approval request', requestedBy: name, pendingWith: '' });
        }
        if (String(row.flexibleOtStatus || '') === 'pending') {
            pushPendingLine(map, date, { label: 'Overtime request', requestedBy: name, pendingWith: '' });
        }
    });
    return map;
}
