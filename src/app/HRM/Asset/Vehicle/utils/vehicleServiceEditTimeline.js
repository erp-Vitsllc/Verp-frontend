/**
 * Schedule / Initiate edit rows for Service Workflow History.
 * Shown between Schedule and HR Approval (or Schedule and On Service when no HR step).
 * Applies to Oil / Tire / Mechanical / Body / Accident — not Car Wash.
 */

const ADMIN_EDIT_TYPES = new Set(['schedule_resubmitted', 'date_change', 'garage_updated']);
const HR_EDIT_TYPES = new Set(['initiate_edited']);

export function isServiceEditActivityType(type) {
    const t = String(type || '').trim();
    return ADMIN_EDIT_TYPES.has(t) || HR_EDIT_TYPES.has(t);
}

/** Collect activity rows from remark logs (shop types share tireActivityLog on the backend). */
export function collectRemarkEditActivities(remark = {}, activityLogKey = '') {
    const bags = [];
    if (activityLogKey && Array.isArray(remark[activityLogKey])) bags.push(remark[activityLogKey]);
    if (Array.isArray(remark.tireActivityLog)) bags.push(remark.tireActivityLog);
    if (Array.isArray(remark.oilActivityLog)) bags.push(remark.oilActivityLog);
    if (Array.isArray(remark.mechanicalActivityLog)) bags.push(remark.mechanicalActivityLog);
    if (Array.isArray(remark.bodyWorkActivityLog)) bags.push(remark.bodyWorkActivityLog);
    if (Array.isArray(remark.accidentActivityLog)) bags.push(remark.accidentActivityLog);

    const seen = new Set();
    const out = [];
    for (const bag of bags) {
        for (const entry of bag) {
            if (!isServiceEditActivityType(entry?.type)) continue;
            const key = [
                entry.type,
                entry.at || '',
                entry.byName || '',
                entry.note || '',
                entry.field || '',
                entry.from || '',
                entry.to || '',
            ].join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(entry);
        }
    }
    return out.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
}

/** Also map workflow history actions that mirror schedule/initiate edits. */
export function collectHistoryEditActivities(history = []) {
    if (!Array.isArray(history)) return [];
    return history
        .filter((h) => {
            const action = String(h.action || '').toLowerCase();
            return (
                action === 'schedule_resubmitted' ||
                action === 'date_change' ||
                action === 'initiate_edited'
            );
        })
        .map((h) => ({
            type: String(h.action || '').toLowerCase(),
            at: h.at,
            byName: h.byName || '',
            note: h.note || '',
            field: h.field,
            from: h.from,
            to: h.to,
        }));
}

function actorFirstName(name) {
    const cleaned = String(name || '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();
    if (!cleaned) return '';
    return cleaned.split(/\s+/).filter(Boolean)[0] || cleaned;
}

function formatEditDate(value) {
    if (!value) return '—';
    const str = String(value).trim();
    let iso = str;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) iso = str.slice(0, 10);
    else if (/^\d{4}-\d{2}$/.test(str)) iso = `${str}-01`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Drop date_change rows that sit next to a schedule_resubmitted (same Admin update).
 */
export function dedupeScheduleEditActivities(activities = []) {
    const rows = [...activities].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
    const resubmitMs = rows
        .filter((a) => a.type === 'schedule_resubmitted')
        .map((a) => new Date(a.at || 0).getTime())
        .filter((n) => Number.isFinite(n));

    return rows.filter((a) => {
        if (a.type !== 'date_change') return true;
        const ms = new Date(a.at || 0).getTime();
        if (!Number.isFinite(ms)) return true;
        return !resubmitMs.some((r) => Math.abs(r - ms) <= 8000);
    });
}

/**
 * @param {object[]} activities
 * @param {{ idPrefix?: string, slot?: string }} [opts]
 */
export function buildServiceEditTimelineEvents(activities = [], { idPrefix = 'svc-edit', slot = 'mid' } = {}) {
    const cleaned = dedupeScheduleEditActivities(activities);
    return cleaned.map((a, index) => {
        const isHr = HR_EDIT_TYPES.has(a.type);
        const role = isHr ? 'HR' : 'Admin';
        const name = actorFirstName(a.byName) || role;
        let detail = a.note || (isHr ? 'Initiate Service updated' : 'Schedule updated');
        if (a.type === 'date_change' && (a.from || a.to)) {
            const fieldLabel = a.field === 'end' ? 'End date' : 'Start date';
            detail = `${fieldLabel}: ${formatEditDate(a.from)} → ${formatEditDate(a.to)}`;
        }
        return {
            id: `${idPrefix}-${slot}-${index}-${a.at || index}`,
            kind: 'schedule-edit',
            stepNumber: null,
            label: `Done by ${role}: ${name}`,
            badge: 'Done',
            badgeVariant: 'approved',
            actor: '',
            date: a.at || null,
            detail,
            connectorGreen: true,
            isLast: false,
        };
    });
}

/** Insert edit rows immediately after the given workflow step number. */
export function insertTimelineEventsAfterStep(events = [], stepNumber, insertRows = []) {
    if (!insertRows.length) return events;
    const idx = events.findIndex((e) => Number(e.stepNumber) === Number(stepNumber));
    if (idx < 0) {
        return [...events, ...insertRows];
    }
    const next = [...events.slice(0, idx + 1), ...insertRows, ...events.slice(idx + 1)];
    next.forEach((row, i) => {
        row.isLast = i === next.length - 1;
    });
    return next;
}
